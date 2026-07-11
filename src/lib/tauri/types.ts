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
}

export interface TrackResult {
  track?: TrackInfo;
  error?: string;
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
