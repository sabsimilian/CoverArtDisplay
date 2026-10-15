// Extra Spotify data for the info layout that the 10s poll doesn't carry:
// album label, Liked Songs status, the next few queued tracks and the name of
// the playlist/album being played from. Fetched once per track change (album
// and context names are cached for good), never on every poll — they spend
// the same development-mode quota as the poll itself.

import { spotifyApi } from "../tauri/api";
import { isRateLimited, noteRateLimit } from "./playback.svelte";
import type { AlbumDetails, LookupResult, QueueItem, RecentTrack, TrackInfo } from "../tauri/types";

const albumDetails = $state<Record<string, AlbumDetails>>({});
const contextNames = $state<Record<string, string>>({});
const liked = $state<Record<string, boolean>>({});
const queues = $state<Record<string, QueueItem[]>>({});
let lastPlayed = $state<RecentTrack | null>(null);

const pending = new Set<string>();
// Keys whose lookup failed (other than a 429). Not retried until the track
// changes — otherwise e.g. a 404 on a Spotify-owned playlist, which
// development-mode apps can't read, would be re-requested on every poll.
const failed = new Set<string>();

export const trackExtras = {
  album: (albumId: string): AlbumDetails | undefined => albumDetails[albumId],
  contextName: (uri: string): string | undefined => contextNames[uri],
  liked: (trackId: string): boolean => liked[trackId] ?? false,
  queue: (trackId: string): QueueItem[] => queues[trackId] ?? [],
  get lastPlayed() {
    return lastPlayed;
  },
};

// Runs fn once per key at a time; a rate-limited answer locks out the poll as
// well, and other failures are left to the next track change to retry.
async function lookup<T>(key: string, fn: () => Promise<LookupResult<T>>, store: (value: T) => void): Promise<void> {
  if (pending.has(key) || failed.has(key) || isRateLimited()) return;
  pending.add(key);
  try {
    const result = await fn();
    if (result.retryAfterSecs !== undefined) noteRateLimit(result.retryAfterSecs);
    else if (result.value !== undefined) store(result.value);
    else failed.add(key);
  } catch {
    failed.add(key);
  } finally {
    pending.delete(key);
  }
}

export function fetchTrackExtras(track: TrackInfo, wantQueue: boolean): void {
  if (track.albumId && !(track.albumId in albumDetails)) {
    void lookup(`album:${track.albumId}`, () => spotifyApi.getAlbumDetails(track.albumId), (v) => {
      albumDetails[track.albumId] = v;
    });
  }
  const uri = track.contextUri;
  const named = track.contextType && track.contextType !== "collection";
  if (wantQueue && uri && named && !(uri in contextNames)) {
    void lookup(`context:${uri}`, () => spotifyApi.getContextName(uri), (v) => {
      contextNames[uri] = v;
    });
  }
  if (track.id && !(track.id in liked)) {
    void lookup(`liked:${track.id}`, () => spotifyApi.isTrackSaved(track.id), (v) => {
      liked[track.id] = v;
    });
  }
  if (wantQueue && track.id && !(track.id in queues)) {
    void lookup(`queue:${track.id}`, () => spotifyApi.getQueue(), (v) => {
      queues[track.id] = v;
    });
  }
}

// Clear per-track answers when the track changes, so coming back to a track
// later (or a re-ordered queue) gets a fresh answer rather than a stale one.
export function forgetTrack(trackId: string): void {
  delete liked[trackId];
  delete queues[trackId];
  failed.clear();
}

export function fetchLastPlayed(): void {
  void lookup("lastPlayed", () => spotifyApi.getLastPlayed(), (v) => {
    lastPlayed = v;
  });
}
