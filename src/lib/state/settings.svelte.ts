// The single persisted settings blob — mirrors V1's one-localStorage-key
// ('appSettings') schema so the separate settings popup window (same page,
// ?settingsOnly=1) and the main window always agree on one shape. Built on
// top of persisted() (see persisted.svelte.ts), which already handles
// cross-window sync via the `storage` event.
//
// `startupModeEnabled` is deliberately NOT part of this blob — V1 always
// re-reads that live from the OS (tauri_plugin_autostart) instead of trusting
// a possibly-stale persisted value; the App Settings tab does the same here.

import { persisted } from "./persisted.svelte";
import { appApi } from "../tauri/api";

export type StandbyMode = "videoart" | "librarycovers" | "pictureframe";
export type BackgroundStyle = "static" | "gradient" | "coverimage";

export interface AppSettings {
  standbyModePreference: StandbyMode;
  mediaChangeInterval: number; // seconds, 30-1800
  videoSources: string[];
  videoFolders: string[];
  folderVideos: Record<string, string[]>;
  areaUnderCoverBgColor: string;
  areaUnderCoverDynamic: boolean; // false = Static
  areaBgBlurredCoverMode: boolean; // true = Cover Image (only meaningful when areaUnderCoverDynamic)
  areaTransparentMode: boolean;
  textWhiteMode: boolean;
  textOpacity: number; // 50-100
  appFontFamily: string;
  startInFullscreen: boolean;
  photoFolders: string[];
  photoFiles: Record<string, string[]>;
  pictureFrameBW: boolean;
  ambientClockEnabled: boolean;
  blurStyleEnabled: boolean;
  startInWidgetMode: boolean;
  accentColor: string;
  controlsEnabled: boolean;
  progressBarEnabled: boolean;
  // Distinct from startInWidgetMode (an explicit "always launch into widget
  // mode" preference) — this instead just remembers whichever mode the
  // window was actually in when last closed, so closing while in widget
  // mode resumes there next launch instead of snapping back to the full
  // view at the widget's small saved size.
  lastWidgetModeActive: boolean;
}

const DEFAULTS: AppSettings = {
  standbyModePreference: "videoart",
  mediaChangeInterval: 300,
  videoSources: [],
  videoFolders: [],
  folderVideos: {},
  areaUnderCoverBgColor: "#181818",
  areaUnderCoverDynamic: false,
  areaBgBlurredCoverMode: false,
  areaTransparentMode: false,
  textWhiteMode: true,
  textOpacity: 100,
  appFontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  startInFullscreen: false,
  photoFolders: [],
  photoFiles: {},
  pictureFrameBW: false,
  ambientClockEnabled: false,
  blurStyleEnabled: false,
  startInWidgetMode: false,
  accentColor: "#1DB954",
  controlsEnabled: true,
  progressBarEnabled: true,
  lastWidgetModeActive: false,
};

const store = persisted<AppSettings>("appSettings", DEFAULTS);

export function backgroundStyle(s: AppSettings): BackgroundStyle {
  if (!s.areaUnderCoverDynamic) return "static";
  return s.areaBgBlurredCoverMode ? "coverimage" : "gradient";
}

export function setBackgroundStyle(style: BackgroundStyle): void {
  store.value = {
    ...store.value,
    areaUnderCoverDynamic: style !== "static",
    areaBgBlurredCoverMode: style === "coverimage",
  };
}

export const settings = {
  get value(): AppSettings {
    return store.value;
  },
  set value(next: AppSettings) {
    store.value = next;
  },

  // ── Video sources ────────────────────────────────────────────────────────
  addVideoSource(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed || store.value.videoSources.includes(trimmed)) return false;
    store.value = { ...store.value, videoSources: [...store.value.videoSources, trimmed] };
    return true;
  },
  deleteVideoSource(index: number): void {
    const next = store.value.videoSources.filter((_, i) => i !== index);
    store.value = { ...store.value, videoSources: next };
  },
  addVideoFolderEntry(folderPath: string): boolean {
    if (store.value.videoFolders.includes(folderPath)) return false;
    store.value = {
      ...store.value,
      videoFolders: [...store.value.videoFolders, folderPath],
      folderVideos: { ...store.value.folderVideos, [folderPath]: [] },
    };
    return true;
  },
  setFolderVideos(folderPath: string, videos: string[]): void {
    store.value = { ...store.value, folderVideos: { ...store.value.folderVideos, [folderPath]: videos } };
  },
  deleteVideoFolder(folderPath: string): void {
    const folderVideos = { ...store.value.folderVideos };
    delete folderVideos[folderPath];
    store.value = {
      ...store.value,
      videoFolders: store.value.videoFolders.filter((f) => f !== folderPath),
      folderVideos,
    };
  },
  resetVideoSources(): void {
    store.value = { ...store.value, videoSources: [], videoFolders: [], folderVideos: {} };
  },
  getAllAvailableVideos(): string[] {
    return [...store.value.videoSources, ...Object.values(store.value.folderVideos).flat()];
  },

  // ── Photo sources ────────────────────────────────────────────────────────
  addPhotoFolderEntry(folderPath: string): boolean {
    if (store.value.photoFolders.includes(folderPath)) return false;
    store.value = {
      ...store.value,
      photoFolders: [...store.value.photoFolders, folderPath],
      photoFiles: { ...store.value.photoFiles, [folderPath]: [] },
    };
    return true;
  },
  setFolderPhotos(folderPath: string, photos: string[]): void {
    store.value = { ...store.value, photoFiles: { ...store.value.photoFiles, [folderPath]: photos } };
  },
  deletePhotoFolder(folderPath: string): void {
    const photoFiles = { ...store.value.photoFiles };
    delete photoFiles[folderPath];
    store.value = {
      ...store.value,
      photoFolders: store.value.photoFolders.filter((f) => f !== folderPath),
      photoFiles,
    };
  },
  resetPhotoSources(): void {
    store.value = { ...store.value, photoFolders: [], photoFiles: {} };
  },
  getAllAvailablePhotos(): string[] {
    return Object.values(store.value.photoFiles).flat();
  },
};

// ── Launch on Startup ─────────────────────────────────────────────────────
// Deliberately not part of the persisted blob (see file header) — always
// queried/mutated live against the OS.
export async function getAutoStart(): Promise<boolean> {
  try {
    return await appApi.getAutoStart();
  } catch {
    return false;
  }
}

export async function setAutoStart(enabled: boolean): Promise<boolean> {
  return appApi.setAutoStart(enabled);
}
