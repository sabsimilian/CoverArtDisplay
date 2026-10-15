// Idle-mode orchestration — replaces V1's switchToMode() dispatch + its
// per-mode startVideoShuffle/startLibraryShuffle/startPhotoChange timers.
// Deliberately simpler than V1 here: Picture Frame is idle-only just like
// Video Art and Library Covers (a confirmed deviation from V1's actual
// behavior, where selecting Picture Frame overrode the now-playing view
// even while music was playing).
//
// Timers are started/stopped by the mounted StandbyView component's own
// $effect (see StandbyView.svelte) rather than a module-level $effect here —
// module-scope runes have no owning effect root to clean up after.

import { playback } from "./playback.svelte";
import { settings } from "./settings.svelte";
import { fetchRandomAlbumWithRetry } from "../utils/random-album";
import { isRateLimited } from "./playback.svelte";
import type { AlbumInfo } from "../tauri/types";
import type { StandbyMode } from "./settings.svelte";

export type ActiveMode = "player" | StandbyMode;

let currentVideoUrl = $state<string | null>(null);
let currentAlbum = $state<AlbumInfo | null>(null);
let currentPhotoUrl = $state<string | null>(null);

export const standby = {
  get activeMode(): ActiveMode {
    return playback.isPlaying ? "player" : settings.value.standbyModePreference;
  },
  get currentVideoUrl() {
    return currentVideoUrl;
  },
  get currentAlbum() {
    return currentAlbum;
  },
  get currentPhotoUrl() {
    return currentPhotoUrl;
  },
};

let timer: ReturnType<typeof setInterval> | null = null;
let requestGeneration = 0;

function clearTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function stopShuffle(): void {
  requestGeneration++;
  clearTimer();
}

// Picks a random entry different from the current one when possible — a
// pure random pick avoiding immediate repeat, not a shuffled rotation
// (matches V1's loadNextVideo/loadNextPhoto), capped at 10 retry attempts.
function pickDifferent(pool: string[], current: string | null): string | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let next = current;
  for (let i = 0; i < 10 && next === current; i++) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

function refreshVideo(): void {
  currentVideoUrl = pickDifferent(settings.getAllAvailableVideos(), currentVideoUrl);
}

function refreshPhoto(): void {
  currentPhotoUrl = pickDifferent(settings.getAllAvailablePhotos(), currentPhotoUrl);
}

async function refreshAlbum(): Promise<void> {
  // Same Spotify quota as the now-playing poll — keep the current cover
  // rather than spend requests (and retries) during a rate-limit lockout.
  if (isRateLimited()) return;
  const generation = ++requestGeneration;
  const album = await fetchRandomAlbumWithRetry(() => requestGeneration === generation);
  if (requestGeneration === generation) currentAlbum = album;
}

export function startShuffleFor(mode: StandbyMode, intervalSeconds: number): void {
  clearTimer();
  requestGeneration++;
  const seconds = Math.max(intervalSeconds, 1);
  if (mode === "videoart") {
    refreshVideo();
    timer = setInterval(refreshVideo, seconds * 1000);
  } else if (mode === "librarycovers") {
    refreshAlbum();
    timer = setInterval(refreshAlbum, seconds * 1000);
  } else if (mode === "pictureframe") {
    refreshPhoto();
    timer = setInterval(refreshPhoto, seconds * 1000);
  }
}
