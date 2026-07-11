// Whether this page load is the dedicated settings-only popup window (opened
// via open_settings_window in the Rust backend). Detected by the window's
// label ("settings", set at creation in lib.rs) rather than a URL query
// string — WebviewUrl::App takes a plain PathBuf, which has no concept of a
// query string, so a "?settingsOnly=1" suffix was literally treated as part
// of the filename to look up (a real 404), not a routing flag.
import { getCurrentWindow } from "@tauri-apps/api/window";

export function isSettingsOnly(): boolean {
  if (typeof window === "undefined") return false;
  return getCurrentWindow().label === "settings";
}
