use std::{fs, path::PathBuf, sync::Mutex};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};

const CLIENT_ID: &str   = "dd68d34cdb834f63a404faa8f75bb0af";
const REDIRECT_URI: &str = "spotify-cover-art://auth";
const VIDEO_EXTS: &[&str] = &["mp4", "webm", "mov", "mkv"];
const PHOTO_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];
// check_for_updates() reads this repo's "latest release" GitHub API endpoint.
const UPDATE_REPO: &str = "sabsimilian/CoverArtDisplay";

// ── Managed state ─────────────────────────────────────────────────────────────

#[derive(Default, Serialize, Deserialize, Clone)]
struct TokenData {
    access_token:  Option<String>,
    refresh_token: Option<String>,
    expires_at:    Option<u64>,
}

struct AppState {
    tokens:        Mutex<TokenData>,
    auth_state:    Mutex<Option<String>>,
    code_verifier: Mutex<Option<String>>,
}

// ── Serialisable response types ───────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TrackInfo {
    id:          String,
    name:        String,
    artist:      String,
    album_name:  String,
    cover_url:   String,
    is_playing:  bool,
    progress_ms: u64,
    duration_ms: u64,
}

#[derive(Serialize)]
struct TrackResult {
    #[serde(skip_serializing_if = "Option::is_none")] track: Option<TrackInfo>,
    #[serde(skip_serializing_if = "Option::is_none")] error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct SpotifyImage {
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")] width:  Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")] height: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
struct AlbumInfo {
    name:    String,
    artists: String,
    images:  Vec<SpotifyImage>,
    id:      String,
    #[serde(skip_serializing_if = "Option::is_none")] release_date: Option<String>,
}

#[derive(Serialize)]
struct AlbumResult {
    #[serde(skip_serializing_if = "Option::is_none")] album: Option<AlbumInfo>,
    #[serde(skip_serializing_if = "Option::is_none")] error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct SavedAlbumItem { album: AlbumInfo }

#[derive(Serialize)]
struct SavedAlbumsResult {
    #[serde(skip_serializing_if = "Option::is_none")] items: Option<Vec<SavedAlbumItem>>,
    #[serde(skip_serializing_if = "Option::is_none")] total: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")] next:  Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCheckResult {
    update_available: bool,
    current_version:  String,
    latest_version:   String,
    #[serde(skip_serializing_if = "Option::is_none")] release_url:   Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] release_notes: Option<String>,
    // Direct download link (and filename) for this platform's installer, if
    // the release has one attached — lets the Settings UI offer "download and
    // install" instead of just linking to the GitHub release page.
    #[serde(skip_serializing_if = "Option::is_none")] asset_url:     Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] asset_name:    Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")] error:         Option<String>,
}

#[derive(Serialize)]
struct VideosResult { videos: Vec<String>, error: Option<String> }

#[derive(Serialize)]
struct PhotosResult { photos: Vec<String>, error: Option<String> }

// ── Token persistence ─────────────────────────────────────────────────────────

fn token_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("tokens.json")
}

// Whether the window was in widget mode when last closed — kept here
// rather than in the frontend's localStorage-backed settings blob because
// correctly restoring widget mode's small window size on launch depends on
// reading this *before* the frontend has even loaded (see enable_widget_mode
// below), and because localStorage's on-disk flush timing isn't guaranteed
// the way a direct file write is (see atomic_write's own comment) — this is
// exactly the kind of small, launch-critical flag that needs to survive an
// abrupt kill, not just a clean exit.
fn widget_mode_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("widget_mode_active.txt")
}

#[tauri::command]
fn get_last_widget_mode(app: AppHandle) -> bool {
    fs::read_to_string(widget_mode_path(&app))
        .map(|s| s.trim() == "true")
        .unwrap_or(false)
}

#[tauri::command]
fn set_last_widget_mode(app: AppHandle, active: bool) {
    atomic_write(&widget_mode_path(&app), if active { "true" } else { "false" });
}

fn load_tokens(app: &AppHandle) -> TokenData {
    fs::read_to_string(token_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_tokens(app: &AppHandle, t: &TokenData) {
    let path = token_path(app);
    if let Some(dir) = path.parent() { let _ = fs::create_dir_all(dir); }
    if let Ok(json) = serde_json::to_string_pretty(t) { atomic_write(&path, &json); }
}

// Writes to a sibling temp file and renames it over the target — rename is
// atomic on both Windows and Linux, so a process killed mid-write (e.g. the
// OS forcibly ending this app during shutdown, since closing the window
// only hides it to the tray rather than exiting — see the CloseRequested
// handler below) can never leave the real file half-written/corrupted. A
// plain fs::write() doesn't have that guarantee: readers can observe a
// truncated file mid-write, and load_tokens()'s JSON parse would silently
// fail and fall back to empty — i.e. an unexplained forced logout.
fn atomic_write(path: &std::path::Path, contents: &str) {
    let tmp = path.with_extension("tmp");
    if fs::write(&tmp, contents).is_ok() {
        let _ = fs::rename(&tmp, path);
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ── PKCE ─────────────────────────────────────────────────────────────────────

fn random_hex(n: usize) -> String {
    hex::encode((0..n).map(|_| rand::random::<u8>()).collect::<Vec<_>>())
}

fn gen_pkce() -> (String, String) {
    let bytes: Vec<u8> = (0..64).map(|_| rand::random::<u8>()).collect();
    let verifier  = URL_SAFE_NO_PAD.encode(&bytes);
    let mut h = Sha256::new();
    h.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(h.finalize().as_slice());
    (verifier, challenge)
}

// ── Token refresh ─────────────────────────────────────────────────────────────

// Wipes stored tokens and tells the renderer to fall back to the login screen.
// Used when Spotify tells us the refresh token itself is no longer valid —
// retrying a refresh with the same token would just fail again.
fn discard_tokens(app: &AppHandle, state: &AppState) {
    use tauri::Emitter;
    *state.tokens.lock().unwrap() = TokenData::default();
    save_tokens(app, &TokenData::default());
    let _ = app.emit("auth-error", ());
}

async fn refresh_token(app: &AppHandle, state: &AppState) -> bool {
    let rt = state.tokens.lock().unwrap().refresh_token.clone();
    let Some(rt) = rt else { return false };

    let client = reqwest::Client::new();
    // Network/transport failure — likely transient (offline, DNS, etc.); keep the
    // stored token around so the next attempt can retry instead of forcing re-login.
    let Ok(resp) = client.post("https://accounts.spotify.com/api/token")
        .form(&[("grant_type","refresh_token"),("refresh_token",&rt),("client_id",CLIENT_ID)])
        .send().await
    else { return false };

    if resp.status() == reqwest::StatusCode::BAD_REQUEST {
        // Spotify returns 400 invalid_grant for an expired/revoked refresh token.
        // Per Spotify's June 2026 policy change, refresh tokens now expire after
        // six months — discard ours and send the user through sign-in again.
        discard_tokens(app, state);
        return false;
    }
    if !resp.status().is_success() { return false }

    let Ok(data) = resp.json::<serde_json::Value>().await else { return false };
    let at = data["access_token"].as_str().unwrap_or("").to_string();
    let ei = data["expires_in"].as_u64().unwrap_or(3600);
    // Spotify's PKCE flow can rotate the refresh token on ANY refresh
    // response, not just the initial code exchange — per their own docs,
    // a new refresh_token in the response must replace the stored one, or
    // the old one gets silently invalidated by the rotation. Missing this
    // was the actual cause of being logged out roughly every access-token
    // lifetime (~1h): the refresh itself would succeed once, but the next
    // one (still using the now-superseded old refresh_token) got a 400 and
    // discard_tokens() kicked in.
    let new_rt = data["refresh_token"].as_str().map(|s| s.to_string());

    let mut t = state.tokens.lock().unwrap();
    t.access_token = Some(at);
    t.expires_at   = Some(now_ms() + ei * 1000);
    if let Some(new_rt) = new_rt {
        t.refresh_token = Some(new_rt);
    }
    save_tokens(app, &t);
    true
}

async fn valid_token(app: &AppHandle, state: &AppState) -> Option<String> {
    let (tok, exp) = {
        let t = state.tokens.lock().unwrap();
        (t.access_token.clone(), t.expires_at.unwrap_or(0))
    };
    tok.as_ref()?;
    if now_ms() + 60_000 > exp {
        if !refresh_token(app, state).await { return None; }
        return state.tokens.lock().unwrap().access_token.clone();
    }
    tok
}

// ── OAuth callback ─────────────────────────────────────────────────────────────

async fn handle_oauth_url(app: &AppHandle, url_str: &str) {
    use tauri::Emitter;

    let query = url_str.splitn(2, '?').nth(1).unwrap_or("");
    let params: std::collections::HashMap<String, String> =
        url::form_urlencoded::parse(query.as_bytes()).into_owned().collect();

    let code = match params.get("code") {
        Some(c) => c.clone(),
        None => { let _ = app.emit("auth-complete", false); return; }
    };
    let ret_state = params.get("state").cloned().unwrap_or_default();

    let state = app.state::<AppState>();
    let expected = state.auth_state.lock().unwrap().clone();
    if Some(ret_state) != expected {
        let _ = app.emit("auth-complete", false);
        return;
    }

    let verifier = match state.code_verifier.lock().unwrap().clone() {
        Some(v) => v,
        None => { let _ = app.emit("auth-complete", false); return; }
    };

    let client = reqwest::Client::new();
    let params_vec = [
        ("grant_type",    "authorization_code"),
        ("code",          code.as_str()),
        ("redirect_uri",  REDIRECT_URI),
        ("client_id",     CLIENT_ID),
        ("code_verifier", verifier.as_str()),
    ];
    match client.post("https://accounts.spotify.com/api/token")
        .form(&params_vec).send().await
    {
        Ok(r) if r.status().is_success() => {
            if let Ok(data) = r.json::<serde_json::Value>().await {
                let new_tokens = TokenData {
                    access_token:  Some(data["access_token"].as_str().unwrap_or("").to_string()),
                    refresh_token: data["refresh_token"].as_str().map(|s| s.to_string()),
                    expires_at:    Some(now_ms() + data["expires_in"].as_u64().unwrap_or(3600) * 1000),
                };
                *state.tokens.lock().unwrap() = new_tokens.clone();
                save_tokens(app, &new_tokens);
                if let Some(win) = app.get_webview_window("main") { let _ = win.show(); }
                let _ = app.emit("auth-complete", true);
            }
        }
        _ => { let _ = app.emit("auth-complete", false); }
    }
}

// ── IPC commands ──────────────────────────────────────────────────────────────

#[tauri::command]
fn spotify_check_auth(state: State<'_, AppState>) -> bool {
    state.tokens.lock().unwrap().access_token.is_some()
}

#[tauri::command]
async fn spotify_start_auth(_app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let auth_st = random_hex(16);
    let (verifier, challenge) = gen_pkce();
    *state.auth_state.lock().unwrap()    = Some(auth_st.clone());
    *state.code_verifier.lock().unwrap() = Some(verifier);

    let scope = "user-read-private user-read-email user-read-currently-playing user-read-playback-state user-library-read user-modify-playback-state";
    let url = format!(
        "https://accounts.spotify.com/authorize?client_id={}&response_type=code&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256&show_dialog=false",
        CLIENT_ID,
        urlencoding::encode(REDIRECT_URI),
        urlencoding::encode(scope),
        auth_st,
        challenge,
    );
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn logout(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *state.tokens.lock().unwrap() = TokenData::default();
    save_tokens(&app, &TokenData::default());
    // Close settings popup if open
    if let Some(w) = app.get_webview_window("settings") { let _ = w.close(); }
    // Reload the main page — renderer will detect no auth and show login screen
    if let Some(w) = app.get_webview_window("main") {
        w.eval("window.location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn spotify_get_current_track(app: AppHandle, state: State<'_, AppState>) -> Result<TrackResult, String> {
    let Some(token) = valid_token(&app, &state).await else {
        return Ok(TrackResult { track: None, error: Some("Not authenticated".into()) });
    };
    let resp = reqwest::Client::new()
        .get("https://api.spotify.com/v1/me/player/currently-playing")
        .header("Authorization", format!("Bearer {token}"))
        .send().await.map_err(|e| e.to_string())?;

    if resp.status().as_u16() == 204 {
        return Ok(TrackResult { track: None, error: Some("No track playing".into()) });
    }
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let item = &data["item"];
    if item.is_null() {
        return Ok(TrackResult { track: None, error: Some("No track playing".into()) });
    }
    let artist = item["artists"].as_array()
        .map(|a| a.iter().filter_map(|x| x["name"].as_str()).collect::<Vec<_>>().join(", "))
        .unwrap_or_default();

    Ok(TrackResult {
        track: Some(TrackInfo {
            id:          item["id"].as_str().unwrap_or("").to_string(),
            name:        item["name"].as_str().unwrap_or("").to_string(),
            artist,
            album_name:  item["album"]["name"].as_str().unwrap_or("").to_string(),
            cover_url:   item["album"]["images"][0]["url"].as_str().unwrap_or("").to_string(),
            is_playing:  data["is_playing"].as_bool().unwrap_or(false),
            progress_ms: data["progress_ms"].as_u64().unwrap_or(0),
            duration_ms: item["duration_ms"].as_u64().unwrap_or(0),
        }),
        error: None,
    })
}

// Spotify's play/pause/next/previous endpoints all return 204 with an empty
// body on success and a JSON error body on failure (e.g. no active device) —
// forwarding that message back lets the UI surface something meaningful
// ("no active device") instead of a silent no-op button press.
async fn spotify_player_command(
    app: &AppHandle,
    state: &State<'_, AppState>,
    method: reqwest::Method,
    path: &str,
) -> Result<(), String> {
    let Some(token) = valid_token(app, state).await else {
        return Err("Not authenticated".into());
    };
    let resp = reqwest::Client::new()
        .request(method, format!("https://api.spotify.com/v1/me/player/{path}"))
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Length", "0")
        .send().await.map_err(|e| e.to_string())?;

    if resp.status().is_success() { return Ok(()); }
    let status = resp.status();
    let data: serde_json::Value = resp.json().await.unwrap_or_default();
    let message = data["error"]["message"].as_str().unwrap_or("Playback command failed").to_string();
    Err(format!("{message} ({status})"))
}

#[tauri::command]
async fn spotify_play(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    spotify_player_command(&app, &state, reqwest::Method::PUT, "play").await
}

#[tauri::command]
async fn spotify_pause(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    spotify_player_command(&app, &state, reqwest::Method::PUT, "pause").await
}

#[tauri::command]
async fn spotify_next_track(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    spotify_player_command(&app, &state, reqwest::Method::POST, "next").await
}

#[tauri::command]
async fn spotify_previous_track(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    spotify_player_command(&app, &state, reqwest::Method::POST, "previous").await
}

#[tauri::command]
async fn spotify_get_random_album(app: AppHandle, state: State<'_, AppState>) -> Result<AlbumResult, String> {
    let Some(token) = valid_token(&app, &state).await else {
        return Ok(AlbumResult { album: None, error: Some("Not authenticated".into()) });
    };
    let client = reqwest::Client::new();
    let auth   = format!("Bearer {token}");

    let total: u64 = client.get("https://api.spotify.com/v1/me/tracks?limit=1")
        .header("Authorization", &auth).send().await.map_err(|e| e.to_string())?
        .json::<serde_json::Value>().await.map_err(|e| e.to_string())?
        ["total"].as_u64().unwrap_or(0);

    if total == 0 { return Ok(AlbumResult { album: None, error: Some("No saved tracks".into()) }); }

    let offset = rand::random::<u64>() % total.min(1000);
    let data: serde_json::Value = client
        .get(format!("https://api.spotify.com/v1/me/tracks?limit=1&offset={offset}"))
        .header("Authorization", &auth).send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let track = &data["items"][0]["track"];
    if track.is_null() { return Ok(AlbumResult { album: None, error: Some("No track found".into()) }); }

    let album   = &track["album"];
    let artists = track["artists"].as_array()
        .map(|a| a.iter().filter_map(|x| x["name"].as_str()).collect::<Vec<_>>().join(", "))
        .unwrap_or_default();
    let images  = parse_images(&album["images"]);

    Ok(AlbumResult {
        album: Some(AlbumInfo {
            name:         album["name"].as_str().unwrap_or("").to_string(),
            artists,
            images,
            id:           album["id"].as_str().unwrap_or("").to_string(),
            release_date: album["release_date"].as_str().map(|s| s.to_string()),
        }),
        error: None,
    })
}

#[tauri::command]
async fn spotify_get_saved_albums(
    app: AppHandle,
    state: State<'_, AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<SavedAlbumsResult, String> {
    let Some(token) = valid_token(&app, &state).await else {
        return Ok(SavedAlbumsResult { items: None, total: None, next: None, error: Some("Not authenticated".into()) });
    };
    let limit  = limit.unwrap_or(50).min(50);
    let offset = offset.unwrap_or(0);

    let data: serde_json::Value = reqwest::Client::new()
        .get(format!("https://api.spotify.com/v1/me/albums?limit={limit}&offset={offset}"))
        .header("Authorization", format!("Bearer {token}"))
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let items: Vec<SavedAlbumItem> = data["items"].as_array().map(|arr| {
        arr.iter().filter_map(|item| {
            let album   = &item["album"];
            let artists = album["artists"].as_array()
                .map(|a| a.iter().filter_map(|x| x["name"].as_str()).collect::<Vec<_>>().join(", "))
                .unwrap_or_default();
            Some(SavedAlbumItem {
                album: AlbumInfo {
                    name:         album["name"].as_str().unwrap_or("").to_string(),
                    artists,
                    images:       parse_images(&album["images"]),
                    id:           album["id"].as_str().unwrap_or("").to_string(),
                    release_date: album["release_date"].as_str().map(|s| s.to_string()),
                },
            })
        }).collect()
    }).unwrap_or_default();

    Ok(SavedAlbumsResult {
        total: data["total"].as_u64().map(|v| v as u32),
        next:  data["next"].as_str().map(|s| s.to_string()),
        items: Some(items),
        error: None,
    })
}

#[tauri::command]
fn toggle_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    let fs = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!fs).map_err(|e| e.to_string())?;
    Ok(!fs)
}

#[tauri::command]
fn close_app(app: AppHandle) { app.exit(0); }

#[tauri::command]
fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn select_video_file(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    use tokio::sync::oneshot;
    let (tx, rx) = oneshot::channel();
    app.dialog().file()
        .add_filter("Videos", &["mp4", "webm", "mov", "mkv"])
        .pick_file(move |p| { let _ = tx.send(p); });
    rx.await.ok().flatten().and_then(|p| match p {
        FilePath::Path(path) => Some(path.to_string_lossy().to_string()),
        _ => None,
    })
}

#[tauri::command]
async fn select_video_folder(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::{DialogExt, FilePath};
    use tokio::sync::oneshot;
    let (tx, rx) = oneshot::channel();
    app.dialog().file()
        .set_can_create_directories(true)
        .pick_folder(move |p| { let _ = tx.send(p); });
    rx.await.ok().flatten().and_then(|p| match p {
        FilePath::Path(path) => Some(path.to_string_lossy().to_string()),
        _ => None,
    })
}

// Distinguishes "folder inaccessible" from "folder legitimately empty" —
// callers rely on this to avoid overwriting a previously-known file list
// with an empty one just because a network share/removable drive was
// briefly unavailable.
fn scan_dir(folder: &str, exts: &[&str]) -> Result<Vec<String>, String> {
    let p = std::path::Path::new(folder);
    if !p.is_dir() { return Err(format!("Folder not found or not accessible: {folder}")); }
    let entries = fs::read_dir(p).map_err(|e| e.to_string())?;
    Ok(entries.flatten()
        .filter_map(|e| {
            let path = e.path();
            if !path.is_file() { return None; }
            let ext = path.extension()?.to_str()?.to_lowercase();
            if exts.contains(&ext.as_str()) { Some(path.to_string_lossy().to_string()) } else { None }
        })
        .collect())
}

#[tauri::command]
fn get_folder_videos(folder_path: String) -> VideosResult {
    match scan_dir(&folder_path, VIDEO_EXTS) {
        Ok(videos) => VideosResult { videos, error: None },
        Err(e) => VideosResult { videos: vec![], error: Some(e) },
    }
}

#[tauri::command]
fn get_folder_photos(folder_path: String) -> PhotosResult {
    match scan_dir(&folder_path, PHOTO_EXTS) {
        Ok(photos) => PhotosResult { photos, error: None },
        Err(e) => PhotosResult { photos: vec![], error: Some(e) },
    }
}

#[tauri::command]
fn open_external(_app: AppHandle, url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

// Compares two dotted version strings numerically, component by component
// (so "1.9.0" correctly counts as older than "1.10.0", unlike a plain string
// compare). Missing trailing components are treated as 0.
fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches('v')
            .split('.')
            .map(|part| {
                part.chars().take_while(|c| c.is_ascii_digit()).collect::<String>()
                    .parse().unwrap_or(0)
            })
            .collect()
    };
    let (a, b) = (parse(latest), parse(current));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y { return x > y; }
    }
    false
}

// Picks the release asset that matches this platform's installer, in
// preference order — a GitHub release built by e.g. tauri-action typically
// attaches an NSIS .exe and/or an .msi on Windows, a .dmg on macOS, and an
// .AppImage/.deb on Linux. Also filters by CPU architecture: once a release
// has both amd64 and arm64 Linux builds (e.g. for Raspberry Pi), matching by
// extension alone would let an x86_64 machine's update-check hand back an
// arm64 asset (or vice versa) depending on which happened to be listed
// first — checked against both Rust's own arch name and Debian's, since
// they differ (e.g. "aarch64" vs "arm64").
fn pick_platform_asset(assets: &[serde_json::Value]) -> (Option<String>, Option<String>) {
    let arch_aliases: &[&str] = match std::env::consts::ARCH {
        "x86_64" => &["x86_64", "amd64"],
        "aarch64" => &["aarch64", "arm64"],
        "arm" => &["armv7", "armhf", "arm"],
        "x86" => &["i386", "i686", "x86"],
        other => &[other],
    };
    let exts: &[&str] = if cfg!(target_os = "windows") {
        &[".exe", ".msi"]
    } else if cfg!(target_os = "macos") {
        &[".dmg"]
    } else {
        &[".appimage", ".deb", ".rpm"]
    };
    for ext in exts {
        if let Some(a) = assets.iter().find(|a| {
            let name = a["name"].as_str().unwrap_or("").to_lowercase();
            name.ends_with(ext) && arch_aliases.iter().any(|alias| name.contains(alias))
        }) {
            return (
                a["browser_download_url"].as_str().map(|s| s.to_string()),
                a["name"].as_str().map(|s| s.to_string()),
            );
        }
    }
    (None, None)
}

#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();

    let url = format!("https://api.github.com/repos/{UPDATE_REPO}/releases/latest");
    let resp = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", "spotify-cover-art-display")
        .header("Accept", "application/vnd.github+json")
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(UpdateCheckResult {
            update_available: false,
            current_version,
            latest_version: String::new(),
            release_url: None,
            release_notes: None,
            asset_url: None,
            asset_name: None,
            error: Some(format!("Update check failed: HTTP {}", resp.status())),
        });
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let latest_version = data["tag_name"].as_str().unwrap_or("").trim_start_matches('v').to_string();
    let assets = data["assets"].as_array().cloned().unwrap_or_default();
    let (asset_url, asset_name) = pick_platform_asset(&assets);

    Ok(UpdateCheckResult {
        update_available: is_newer_version(&latest_version, &current_version),
        current_version,
        latest_version,
        release_url: data["html_url"].as_str().map(|s| s.to_string()),
        release_notes: data["body"].as_str().map(|s| s.to_string()),
        asset_url,
        asset_name,
        error: None,
    })
}

#[tauri::command]
async fn download_and_install_update(app: AppHandle, url: String, file_name: String) -> Result<(), String> {
    let bytes = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", "spotify-cover-art-display")
        .send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;

    let dest = std::env::temp_dir().join(&file_name);
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    // Hand off to the OS's default handler for the file (runs the installer,
    // same as double-clicking it), then close this app so the installer can
    // overwrite its files.
    tauri_plugin_opener::open_path(dest.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())?;

    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn set_auto_start(app: AppHandle, enabled: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    if enabled { app.autolaunch().enable().map_err(|e| e.to_string())?; }
    else        { app.autolaunch().disable().map_err(|e| e.to_string())?; }
    Ok(enabled)
}

#[tauri::command]
fn get_auto_start(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

// The main window always skips the taskbar now (see "skipTaskbar" in
// tauri.conf.json — it's tray-only, never a taskbar icon), so widget mode no
// longer needs to touch that itself on enable/disable.
// reset_size is false when *resuming* an already-active widget-mode session
// at launch (see get_last_widget_mode) — tauri-plugin-window-state has
// already restored whatever size the user last left the widget window at by
// this point, and forcing it back to the fixed default here would silently
// throw that away on every single restart, defeating the whole point of
// persisting it. true is for an actual fresh manual toggle-on, where there's
// no prior widget size to preserve and resetting to a sane default is right.
#[tauri::command]
fn enable_widget_mode(window: tauri::WebviewWindow, reset_size: bool) -> Result<(), String> {
    use tauri::LogicalSize;
    // Exact 4:5 ratio (was 308x352 ≈ 7:8) — keep the same rough footprint.
    window.set_min_size(Some(LogicalSize::new(154_f64, 193_f64))).map_err(|e| e.to_string())?;
    if reset_size {
        window.set_size(LogicalSize::new(308_f64, 385_f64)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn disable_widget_mode(window: tauri::WebviewWindow) -> Result<(), String> {
    use tauri::LogicalSize;
    window.set_min_size(Some(LogicalSize::new(320_f64, 400_f64))).map_err(|e| e.to_string())?;
    window.set_size(LogicalSize::new(800_f64, 1000_f64)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show(); let _ = w.set_focus(); return Ok(());
    }
    // Plain "index.html" — WebviewUrl::App takes a PathBuf, which has no
    // concept of a query string, so appending "?settingsOnly=1" here was
    // literally treated as part of the filename to look up (a real 404, not
    // a routing quirk). The frontend instead detects this window by its
    // "settings" label below (see isSettingsOnly() in the frontend).
    let win = WebviewWindowBuilder::new(
        &app, "settings",
        WebviewUrl::App("index.html".into()),
    )
    .title("Settings")
    .inner_size(820.0, 660.0)
    .min_inner_size(600.0, 500.0)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    let app2 = app.clone();
    win.on_window_event(move |ev| {
        if let tauri::WindowEvent::Destroyed = ev {
            if let Some(main) = app2.get_webview_window("main") {
                use tauri::Emitter;
                let _ = main.emit("settings-window-closed", ());
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn close_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") { w.close().map_err(|e| e.to_string())?; }
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn parse_images(v: &serde_json::Value) -> Vec<SpotifyImage> {
    v.as_array().map(|arr| arr.iter().map(|i| SpotifyImage {
        url:    i["url"].as_str().unwrap_or("").to_string(),
        width:  i["width"].as_u64().map(|v| v as u32),
        height: i["height"].as_u64().map(|v| v as u32),
    }).collect()).unwrap_or_default()
}

// ── System tray ──────────────────────────────────────────────────────────────

// The main window never has a taskbar entry (see "skipTaskbar" in
// tauri.conf.json) — this tray icon, with Show/Hide/Exit, is the only way to
// reach it once it's hidden.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&show_item, &hide_item, &PredefinedMenuItem::separator(app)?, &quit_item],
    )?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("Spotify Cover Art")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "hide" => {
                if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    // Not just hidden windows need bringing back — since there's
                    // no taskbar entry, a minimized one (e.g. via the in-app
                    // Minimize button) would otherwise have no way back either.
                    let visible = w.is_visible().unwrap_or(false);
                    let minimized = w.is_minimized().unwrap_or(false);
                    if visible && !minimized { let _ = w.hide(); } else {
                        let _ = w.unminimize();
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's accelerated compositor has a long-standing bug where playing
    // a <video> inside a transparent window (tauri.conf.json sets
    // "transparent": true for the rounded/translucent UI) punches through the
    // window's alpha channel, turning the *entire* window transparent instead
    // of just showing the video — this is what Video Art mode looks like on
    // Raspberry Pi / other Linux installs. Disabling WebKitGTK's compositing
    // mode is the standard workaround; it must be set before the webview is
    // created, so it happens here at the very top of run().
    #[cfg(target_os = "linux")]
    // SAFETY: called single-threaded at the very start of run(), before any
    // other code (including Tauri's own setup) has spawned threads or read
    // these vars, so there's no concurrent-access race.
    unsafe {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // A second instance was launched (e.g. via the OAuth redirect deep link).
            // The "deep-link" cargo feature above already forwards the URL to the
            // deep-link plugin's `deep-link://new-url` event; just surface the window.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent, None,
        ))
        // Remembers the main window's desktop position, size, and maximized
        // state across launches — including full PC restarts, since this
        // plugin persists to a JSON file in the app data dir, not anything
        // session-scoped. SIZE now includes whatever size widget mode was
        // last resized to: settings.svelte.ts's lastWidgetModeActive flag
        // (set in widget.svelte.ts's enable/disable) makes sure the
        // frontend re-enters widget mode on launch whenever the window was
        // closed in it, so a restored widget-sized window always gets the
        // matching compact UI instead of the full view crammed into it.
        // Still NOT FULLSCREEN: restoring fullscreen=true on top of a stale
        // saved position (e.g. from a monitor no longer connected)
        // reproducibly parked the window fully off-screen with no way back
        // short of editing the saved state file by hand — not worth the
        // risk for a toggle one click away in the gear menu. The "settings"
        // popup is excluded from all of this — it's a short-lived utility
        // window, not worth tracking.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .with_denylist(&["settings"])
                .build(),
        )
        .manage(AppState {
            tokens:        Mutex::new(TokenData::default()),
            auth_state:    Mutex::new(None),
            code_verifier: Mutex::new(None),
        })
        .setup(|app| {
            // Restore persisted tokens
            let saved = load_tokens(app.handle());
            *app.state::<AppState>().tokens.lock().unwrap() = saved;

            // Register custom protocol as deep-link handler
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }

            // Listen for OAuth callback
            use tauri::Listener;
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                let urls: Vec<String> = serde_json::from_str(event.payload())
                    .or_else(|_| -> serde_json::Result<Vec<String>> {
                        Ok(vec![serde_json::from_str::<String>(event.payload())?])
                    })
                    .unwrap_or_default();

                for url in urls {
                    if url.starts_with("spotify-cover-art://") {
                        let h = handle.clone();
                        let u = url.clone();
                        tauri::async_runtime::spawn(async move { handle_oauth_url(&h, &u).await; });
                    }
                }
            });

            // Show window (starts as visible:false to avoid transparent flash)
            if let Some(win) = app.get_webview_window("main") { let _ = win.show(); }

            // System tray — the main window is tray-only (skipTaskbar in
            // tauri.conf.json, no taskbar entry ever), so this is the only way
            // to bring it back or exit once it's hidden. If tray creation
            // fails (e.g. an unsupported Linux desktop environment), fall
            // back to letting the window close normally instead of hiding it
            // — otherwise the app could vanish with no way to reach it again.
            let tray_built = build_tray(app.handle()).is_ok();

            fn save_win_state(handle: &AppHandle) {
                use tauri_plugin_window_state::AppHandleExt as _;
                let _ = handle.save_window_state(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                );
            }

            if let Some(win) = app.get_webview_window("main") {
                let win_for_close = win.clone();
                let app_handle = app.handle().clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if tray_built {
                            api.prevent_close();
                            let _ = win_for_close.hide();
                            // Closing (above, hiding to the tray rather than
                            // exiting) is the single most important moment to
                            // save at: it's exactly when the window's final
                            // position/size for this session is set, and
                            // right before the app can sit running hidden
                            // indefinitely and then get killed outright by a
                            // Windows shutdown/restart — with no graceful
                            // exit, and thus no RunEvent::Exit save at all.
                            save_win_state(&app_handle);
                        }
                    }
                });

                // Same reasoning, for the case where the window moves/resizes
                // (e.g. entering widget mode) but is never explicitly closed
                // before an abrupt kill — debounced so a drag's flood of
                // Moved events doesn't hammer disk I/O on every pixel.
                let debounce_id = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
                let app_handle = app.handle().clone();
                win.on_window_event(move |event| {
                    if !matches!(event, tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)) {
                        return;
                    }
                    let this_id = debounce_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                    let handle = app_handle.clone();
                    let debounce_id = debounce_id.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(700)).await;
                        if debounce_id.load(std::sync::atomic::Ordering::SeqCst) == this_id {
                            save_win_state(&handle);
                        }
                    });
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spotify_check_auth,
            spotify_start_auth,
            logout,
            spotify_get_current_track,
            spotify_play,
            spotify_pause,
            spotify_next_track,
            spotify_previous_track,
            spotify_get_random_album,
            spotify_get_saved_albums,
            toggle_fullscreen,
            minimize_window,
            close_app,
            select_video_file,
            select_video_folder,
            get_folder_videos,
            get_folder_photos,
            open_external,
            get_app_version,
            check_for_updates,
            download_and_install_update,
            set_auto_start,
            get_auto_start,
            enable_widget_mode,
            disable_widget_mode,
            get_last_widget_mode,
            set_last_widget_mode,
            open_settings_window,
            close_settings_window,
        ])
        .run(tauri::generate_context!())
        .expect("tauri app failed");
}
