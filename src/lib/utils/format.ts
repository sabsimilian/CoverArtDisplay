// Formats the shared idle-mode "Change Interval" slider value, e.g. 45 ->
// "45s", 60 -> "1m", 90 -> "1m 30s". Matches V1's updateIntervalDisplay().
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds === 60) return "1m";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

// Video/photo source paths come from the OS file picker as full absolute
// paths (Windows uses backslashes) — the Video/Photo Manager lists only need
// the filename for display.
export function pathBasename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.substring(normalized.lastIndexOf("/") + 1);
}

export function truncateEnd(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
