// Shared by Library Covers idle mode and Widget mode's idle-art fallback —
// both just want "one random saved album, tolerating early-boot flakiness".
// Right after launch the Spotify token may not have finished its first
// refresh yet, so a failure here is usually transient; V1 retried 5x/5s
// apart in both call sites separately, duplicating the same logic.

import { spotifyApi } from "../tauri/api";
import type { AlbumInfo } from "../tauri/types";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

// `isStillWanted` lets the caller bail out mid-retry if e.g. the standby mode
// or widget state changed while a retry delay was in flight.
export async function fetchRandomAlbumWithRetry(
  isStillWanted: () => boolean,
): Promise<AlbumInfo | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (!isStillWanted()) return null;
    try {
      const result = await spotifyApi.getRandomAlbum();
      if (result.album) return result.album;
    } catch {
      // Fall through to retry.
    }
    if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  return null;
}
