// A Date that ticks every intervalMs, for clocks and relative times. Must be
// created during component initialisation (it owns an $effect).
export function ticking(intervalMs = 1000) {
  let now = $state(new Date());

  $effect(() => {
    const id = setInterval(() => {
      now = new Date();
    }, intervalMs);
    return () => clearInterval(id);
  });

  return {
    get value() {
      return now;
    },
  };
}

export function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatTrackTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// "just now", "5m ago", "2h ago", "3d ago".
export function formatAgo(from: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
