// Now-playing polling — replaces V1's two redundant setInterval loops
// (updateCurrentTrack @ 3s and updateMusicStatusIndicator @ 5s, originally
// racing on the same global and fixed to one loop mid-session, but still
// hand-rolled). One loop, one reactive source of truth; nothing calls a
// manual "switchToMode()" — components just read `playback.isPlaying`.

import { spotifyApi } from "../tauri/api";
import type { TrackInfo } from "../tauri/types";

let currentTrack = $state<TrackInfo | null>(null);
let isPlaying = $state(false);

export const playback = {
  get currentTrack() {
    return currentTrack;
  },
  get isPlaying() {
    return isPlaying;
  },
};

let pollHandle: ReturnType<typeof setInterval> | null = null;

async function poll(): Promise<void> {
  try {
    const result = await spotifyApi.getCurrentTrack();

    // No track / an error (including Spotify's 204 "nothing playing") means
    // there's authoritatively no active playback. Unlike V1's original
    // updateCurrentTrack (which bailed out on error and left isPlaying
    // frozen on its last value — a bug fixed there this session), this
    // always resolves to a definite state.
    if (result.error || !result.track) {
      isPlaying = false;
      return;
    }

    currentTrack = result.track;
    isPlaying = result.track.isPlaying;
  } catch {
    isPlaying = false;
  }
}

export function startPolling(): void {
  if (pollHandle) return;
  poll();
  pollHandle = setInterval(poll, 3000);
}

export function stopPolling(): void {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

// Flip the local flag immediately (the 3s poll would otherwise leave a
// button press looking unresponsive for up to that long) and revert it if
// Spotify actually rejected the command (e.g. no active device).
export async function togglePlayPause(): Promise<void> {
  const wasPlaying = isPlaying;
  isPlaying = !wasPlaying;
  try {
    await (wasPlaying ? spotifyApi.pause() : spotifyApi.play());
  } catch {
    isPlaying = wasPlaying;
  }
  poll();
}

// Spotify's queue needs a beat to actually advance before the
// currently-playing endpoint reflects it — polling immediately after the
// command would usually just re-read the track that was just left.
export async function skipNext(): Promise<void> {
  try {
    await spotifyApi.nextTrack();
  } catch {
    return;
  }
  setTimeout(poll, 400);
}

export async function skipPrevious(): Promise<void> {
  try {
    await spotifyApi.previousTrack();
  } catch {
    return;
  }
  setTimeout(poll, 400);
}
