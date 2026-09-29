// Now-playing polling — replaces V1's two redundant setInterval loops
// (updateCurrentTrack @ 3s and updateMusicStatusIndicator @ 5s, originally
// racing on the same global and fixed to one loop mid-session, but still
// hand-rolled). One loop, one reactive source of truth; nothing calls a
// manual "switchToMode()" — components just read `playback.isPlaying`.

import { spotifyApi } from "../tauri/api";
import type { TrackInfo } from "../tauri/types";

let currentTrack = $state<TrackInfo | null>(null);
let isPlaying = $state(false);

// While Spotify is rate limiting us (429), no request goes out before this
// (epoch ms). Persisted so an app restart mid-lockout doesn't immediately
// spend another request — Spotify's development-mode lockouts last hours.
const RATE_LIMIT_KEY = "spotifyRateLimitedUntil";
let rateLimitedUntil = $state(loadRateLimit());

function loadRateLimit(): number {
  try {
    const until = Number(localStorage.getItem(RATE_LIMIT_KEY));
    return until > Date.now() ? until : 0;
  } catch {
    return 0;
  }
}

function setRateLimit(until: number): void {
  rateLimitedUntil = until;
  try {
    localStorage.setItem(RATE_LIMIT_KEY, String(until));
  } catch {
    // Storage unavailable — the in-memory value still holds for this run.
  }
}

export const playback = {
  get currentTrack() {
    return currentTrack;
  },
  get isPlaying() {
    return isPlaying;
  },
  // Epoch ms until which Spotify is rate limiting us, or 0.
  get rateLimitedUntil() {
    return rateLimitedUntil;
  },
};

export function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

// Poll cadence. Spotify's development-mode quota (shared by every app on the
// developer account) can't absorb a fixed 3s poll around the clock (~28,800
// requests/day), and running out means a lockout of hours. So while playing,
// poll just after the current track should end, but at least every
// MAX_PLAYING_POLL_MS to catch skips and pauses; when idle, back off to
// IDLE_POLL_MS. A track starting from idle shows up within IDLE_POLL_MS.
const MAX_PLAYING_POLL_MS = 10000;
const MIN_PLAYING_POLL_MS = 2000;
// Spotify reports the next track a moment after the previous one ends.
const TRACK_END_GRACE_MS = 1500;
const IDLE_POLL_MS = 30000;

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let polling = false;

function playingDelay(track: TrackInfo): number {
  const untilEnd = track.durationMs - track.progressMs + TRACK_END_GRACE_MS;
  return Math.min(Math.max(untilEnd, MIN_PLAYING_POLL_MS), MAX_PLAYING_POLL_MS);
}

// Returns the delay before the next poll.
async function poll(): Promise<number> {
  if (Date.now() < rateLimitedUntil) return rateLimitedUntil - Date.now();
  try {
    const result = await spotifyApi.getCurrentTrack();

    // Rate limited: wait as long as Spotify asks, and keep showing the last
    // known state meanwhile — the 429 says nothing about what's playing.
    if (result.retryAfterSecs !== undefined) {
      setRateLimit(Date.now() + result.retryAfterSecs * 1000);
      return result.retryAfterSecs * 1000;
    }

    // No track / "not authenticated" / Spotify's 204 "nothing playing" means
    // there's authoritatively no active playback, so this still always
    // resolves to a definite state (unlike V1's original updateCurrentTrack,
    // which bailed out on error and left isPlaying frozen).
    if (result.error || !result.track) {
      isPlaying = false;
      return IDLE_POLL_MS;
    }

    currentTrack = result.track;
    isPlaying = result.track.isPlaying;
    if (isPlaying) return playingDelay(result.track);
  } catch {
    // Transport failure or a Spotify-side error — transient, and not evidence
    // that playback stopped, so leave the last state alone and retry soon.
  }
  return isPlaying && currentTrack ? playingDelay(currentTrack) : IDLE_POLL_MS;
}

function schedule(delayMs: number): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(runPoll, delayMs);
}

async function runPoll(): Promise<void> {
  pollTimer = null;
  const delay = await poll();
  if (polling && !pollTimer) schedule(delay);
}

// Poll now and restart the cadence from here — used after the user changes
// playback, so the result shows up without waiting out a long idle delay.
function pollSoon(delayMs = 0): void {
  if (polling) schedule(delayMs);
  else void poll();
}

export function startPolling(): void {
  if (polling) return;
  polling = true;
  schedule(0);
}

export function stopPolling(): void {
  polling = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// Flip the local flag immediately (the next poll would otherwise leave a
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
  pollSoon();
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
  pollSoon(400);
}

export async function skipPrevious(): Promise<void> {
  try {
    await spotifyApi.previousTrack();
  } catch {
    return;
  }
  pollSoon(400);
}
