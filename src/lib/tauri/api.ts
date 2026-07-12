// Typed wrapper around every Tauri command this app calls — replaces V1's
// hand-maintained window.electron/window.spotifyAPI shim (src/tauri-shim.js)
// with real TypeScript signatures matching the Rust commands in
// src-tauri/src/lib.rs. A renamed/removed Rust command, or a shape mismatch,
// is now a compile error here instead of a silent runtime `undefined`.

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  TrackResult,
  AlbumResult,
  SavedAlbumsResult,
  UpdateCheckResult,
  VideosResult,
  PhotosResult,
} from "./types";

// Local file paths (from folder scans / file pickers) need to go through
// Tauri's asset:// protocol to be loadable as a <video>/<img> src. Network
// URLs (Spotify's CDN cover art) pass through unchanged.
function toMediaUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return convertFileSrc(path);
}

export const spotifyApi = {
  checkAuth: (): Promise<boolean> => invoke("spotify_check_auth"),
  startAuth: (): Promise<void> => invoke("spotify_start_auth"),
  logout: (): Promise<void> => invoke("logout"),
  getCurrentTrack: (): Promise<TrackResult> => invoke("spotify_get_current_track"),
  getRandomAlbum: (): Promise<AlbumResult> => invoke("spotify_get_random_album"),
  getSavedAlbums: (limit = 50, offset = 0): Promise<SavedAlbumsResult> =>
    invoke("spotify_get_saved_albums", { limit, offset }),

  play: (): Promise<void> => invoke("spotify_play"),
  pause: (): Promise<void> => invoke("spotify_pause"),
  nextTrack: (): Promise<void> => invoke("spotify_next_track"),
  previousTrack: (): Promise<void> => invoke("spotify_previous_track"),

  onAuthComplete: (cb: (success: boolean) => void): Promise<UnlistenFn> =>
    listen<boolean>("auth-complete", (e) => cb(e.payload)),
  onAuthError: (cb: () => void): Promise<UnlistenFn> =>
    listen("auth-error", () => cb()),
};

export const appApi = {
  toggleFullscreen: (): Promise<boolean> => invoke("toggle_fullscreen"),
  minimizeWindow: (): Promise<void> => invoke("minimize_window"),
  closeApp: (): Promise<void> => invoke("close_app"),

  selectVideoFile: (): Promise<string | null> => invoke("select_video_file"),
  selectVideoFolder: (): Promise<string | null> => invoke("select_video_folder"),

  getFolderVideos: async (folderPath: string): Promise<VideosResult> => {
    const result = await invoke<VideosResult>("get_folder_videos", { folderPath });
    return { ...result, videos: result.videos.map(toMediaUrl) };
  },
  getFolderPhotos: async (folderPath: string): Promise<PhotosResult> => {
    const result = await invoke<PhotosResult>("get_folder_photos", { folderPath });
    return { ...result, photos: result.photos.map(toMediaUrl) };
  },

  openExternal: (url: string): Promise<void> => invoke("open_external", { url }),
  getAppVersion: (): Promise<string> => invoke("get_app_version"),
  checkForUpdates: (): Promise<UpdateCheckResult> => invoke("check_for_updates"),
  downloadAndInstallUpdate: (url: string, fileName: string): Promise<void> =>
    invoke("download_and_install_update", { url, fileName }),
  setAutoStart: (enabled: boolean): Promise<boolean> => invoke("set_auto_start", { enabled }),
  getAutoStart: (): Promise<boolean> => invoke("get_auto_start"),

  enableWidgetMode: (): Promise<void> => invoke("enable_widget_mode"),
  disableWidgetMode: (): Promise<void> => invoke("disable_widget_mode"),
  // Backed by a plain file (see set_last_widget_mode in lib.rs), not the
  // localStorage-backed settings blob — this needs to survive an abrupt
  // process kill (closing the window only hides it to the tray, so the app
  // can be running hidden when Windows kills it during a shutdown), and
  // localStorage's on-disk flush timing isn't guaranteed the way a direct
  // file write is.
  getLastWidgetMode: (): Promise<boolean> => invoke("get_last_widget_mode"),
  setLastWidgetMode: (active: boolean): Promise<void> => invoke("set_last_widget_mode", { active }),
  openSettingsWindow: (): Promise<void> => invoke("open_settings_window"),
  closeSettingsWindow: (): Promise<void> => invoke("close_settings_window"),

  onSettingsWindowClosed: (cb: () => void): Promise<UnlistenFn> =>
    listen("settings-window-closed", () => cb()),
};
