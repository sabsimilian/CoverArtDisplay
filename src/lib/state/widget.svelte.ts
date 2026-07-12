// Widget mode — a small always-on-top-sized window (see enable_widget_mode /
// disable_widget_mode in src-tauri/src/lib.rs, which do the actual OS resize).
// `enabled` is deliberately session-only, never persisted (matches V1).

import { appApi } from "../tauri/api";
import { playback } from "./playback.svelte";
import { settings } from "./settings.svelte";
import { fetchRandomAlbumWithRetry } from "../utils/random-album";
import type { AlbumInfo } from "../tauri/types";

let enabled = $state(false);
let idleAlbum = $state<AlbumInfo | null>(null);

export const widget = {
  get enabled() {
    return enabled;
  },
  // Widget mode has no idle-mode picker of its own — it always falls back to
  // random saved-album art (V1's "Library Covers"-style behavior) whenever
  // nothing is currently playing.
  get idleAlbum() {
    return idleAlbum;
  },
};

let shuffleTimer: ReturnType<typeof setInterval> | null = null;
let requestId = 0;

function stopIdleShuffle(): void {
  requestId++; // invalidates any in-flight fetchRandomAlbumWithRetry
  if (shuffleTimer) {
    clearInterval(shuffleTimer);
    shuffleTimer = null;
  }
}

async function refreshIdleAlbum(): Promise<void> {
  const thisRequest = ++requestId;
  const album = await fetchRandomAlbumWithRetry(() => enabled && !playback.isPlaying && requestId === thisRequest);
  if (requestId === thisRequest) idleAlbum = album;
}

function startIdleShuffle(): void {
  stopIdleShuffle();
  requestId++;
  refreshIdleAlbum();
  shuffleTimer = setInterval(refreshIdleAlbum, settings.value.mediaChangeInterval * 1000);
}

export async function enableWidgetMode(): Promise<void> {
  if (enabled) return;
  enabled = true;
  void appApi.setLastWidgetMode(true);
  if (!playback.isPlaying) startIdleShuffle();
  await appApi.enableWidgetMode();
}

export async function disableWidgetMode(): Promise<void> {
  if (!enabled) return;
  enabled = false;
  void appApi.setLastWidgetMode(false);
  stopIdleShuffle();
  idleAlbum = null;
  await appApi.disableWidgetMode();
}

export async function toggleWidgetMode(): Promise<void> {
  if (enabled) await disableWidgetMode();
  else await enableWidgetMode();
}

// Keep the idle-art shuffle in sync with playback state changes and interval
// setting changes while widget mode is active (mirrors updateWidgetIdleState
// in V1). Called from +layout.svelte's root $effect.
export function syncWidgetIdleShuffle(): void {
  if (!enabled) return;
  if (playback.isPlaying) {
    stopIdleShuffle();
    idleAlbum = null;
  } else if (!shuffleTimer) {
    startIdleShuffle();
  }
}
