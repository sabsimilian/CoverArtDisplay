// Mirrors the #[derive(Serialize)] response structs in src-tauri/src/lib.rs.
// Keeping these in sync by hand is the one place this typed layer can still
// drift from the Rust side — but a mismatch now shows up as a TypeScript
// error at every call site instead of a silent `undefined` at runtime.

export interface TrackInfo {
  id: string;
  name: string;
  artist: string;
  albumName: string;
  coverUrl: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  albumId: string;
  releaseDate: string;
  trackNumber: number;
  totalTracks: number;
  contextType?: string;
  contextUri?: string;
  deviceName: string;
  deviceType: string;
  volumePercent?: number;
  shuffle: boolean;
  repeat: "off" | "track" | "context";
}

// Shared shape of the on-demand lookups (album details, liked, queue...).
export interface LookupResult<T> {
  value?: T;
  error?: string;
  retryAfterSecs?: number;
}

export interface AlbumDetails {
  label: string;
  pLine?: string;
}

export interface QueueItem {
  name: string;
  artist: string;
}

export interface RecentTrack {
  name: string;
  artist: string;
  playedAt: string;
}

export interface WeatherNow {
  temperature: number;
  weatherCode: number;
}

export interface TrackResult {
  track?: TrackInfo;
  error?: string;
  // Set when Spotify rate limited the request: seconds to wait before retrying.
  retryAfterSecs?: number;
}

export interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

export interface AlbumInfo {
  name: string;
  artists: string;
  images: SpotifyImage[];
  id: string;
  release_date?: string;
}

export interface AlbumResult {
  album?: AlbumInfo;
  error?: string;
}

export interface SavedAlbumItem {
  album: AlbumInfo;
}

export interface SavedAlbumsResult {
  items?: SavedAlbumItem[];
  total?: number;
  next?: string;
  error?: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  releaseNotes?: string;
  assetUrl?: string;
  assetName?: string;
  error?: string;
}

export interface VideosResult {
  videos: string[];
  error?: string | null;
}

export interface PhotosResult {
  photos: string[];
  error?: string | null;
}
