// Drives the "Gradient" metadata-strip background style — extracts a 2-color
// palette from the currently-displayed cover art and builds a CSS gradient
// from it. Retries a few times because a freshly-set cover URL may not have
// finished decoding (or, for a cross-origin cover, may briefly throw before
// the browser's CORS check settles) the moment this is first called.

import { getPalette } from "colorthief";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function getCoverGradient(url: string): Promise<string | null> {
  if (!url) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const img = await loadImage(url);
      const palette = await getPalette(img, { colorCount: 2 });
      if (palette && palette.length >= 2) {
        return `linear-gradient(70deg, ${palette[0].css()}, ${palette[1].css()})`;
      }
      if (palette && palette.length === 1) {
        return palette[0].css();
      }
    } catch {
      // Fall through to retry.
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
