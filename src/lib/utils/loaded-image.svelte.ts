// Keeps showing the previous cover until the next one has fully downloaded.
// Handing a new URL straight to <img> blanks the cover while it loads — on a
// slow link (a Pi at the edge of Wi-Fi range) for seconds, or for good if the
// request stalls — and the crossfade in CoverArt then fades in a half-loaded
// image. Preloading first means a cover change is only ever a short delay.
//
// Stalled or failed loads are retried a few times with a cache-busting query
// (i.scdn.co ignores it) before giving up and handing the URL over as-is.

import { untrack } from "svelte";

const STALL_MS = 15000;
const RETRY_DELAY_MS = 2000;
const MAX_ATTEMPTS = 3;

export function loadedImage(getUrl: () => string) {
  let shown = $state("");

  $effect(() => {
    const url = getUrl();
    if (!url) {
      shown = "";
      return;
    }
    if (untrack(() => shown) === url) return;

    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // crossOrigin must match CoverArt's <img> so it reuses this cache entry.
    const img = new Image();
    img.crossOrigin = "anonymous";

    const load = () => {
      const src = attempt === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}retry=${attempt}`;
      img.onload = () => {
        if (timer) clearTimeout(timer);
        if (!cancelled) shown = src;
      };
      img.onerror = fail;
      img.src = src;
      timer = setTimeout(fail, STALL_MS);
    };

    const fail = () => {
      if (timer) clearTimeout(timer);
      img.onload = img.onerror = null;
      if (cancelled) return;
      attempt++;
      if (attempt >= MAX_ATTEMPTS) {
        shown = url; // Let <img> have a go itself rather than never changing.
        return;
      }
      timer = setTimeout(load, RETRY_DELAY_MS);
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      img.onload = img.onerror = null;
      img.src = "";
    };
  });

  return {
    get url() {
      return shown;
    },
  };
}
