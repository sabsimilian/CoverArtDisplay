// Panel colours for the info layout, taken from the cover being shown. A
// saturation-weighted average of a 24x24 downsample gives the hue; the
// lightness targets are fixed so white text on the panel always has enough
// contrast whatever the cover looks like.

export interface CoverPalette {
  panel: string;
  track: string;
  accent: string;
}

export const DEFAULT_PALETTE: CoverPalette = {
  panel: "hsl(160 30% 15%)",
  track: "hsl(160 25% 26%)",
  accent: "hsl(150 50% 72%)",
};

const SAMPLE = 24;
const MAX_SATURATION = 60;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function extractPalette(url: string): Promise<CoverPalette | null> {
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const d = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;

    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      // Greys still count a little, so a mostly-grey cover isn't decided by a
      // handful of coloured pixels alone.
      const weight = 0.15 + (max - min) / 255;
      r += d[i] * weight;
      g += d[i + 1] * weight;
      b += d[i + 2] * weight;
      w += weight;
    }
    r /= w * 255;
    g /= w * 255;
    b /= w * 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      h = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
      h *= 60;
    }
    const H = Math.round(h);
    const S = Math.round(Math.min(s * 100, MAX_SATURATION));
    return {
      panel: `hsl(${H} ${Math.round(S * 0.7)}% 15%)`,
      track: `hsl(${H} ${Math.round(S * 0.6)}% 26%)`,
      accent: `hsl(${H} ${Math.max(S, 45)}% 72%)`,
    };
  } catch {
    // Tainted canvas or a failed load — keep whatever palette is showing.
    return null;
  }
}

// Reactive palette for whichever cover URL getUrl() returns. Keeps the
// previous palette until the new one is ready, so colours change once.
export function coverPalette(getUrl: () => string) {
  let palette = $state<CoverPalette>(DEFAULT_PALETTE);

  $effect(() => {
    const url = getUrl();
    if (!url) return;
    let cancelled = false;
    extractPalette(url).then((p) => {
      if (p && !cancelled) palette = p;
    });
    return () => {
      cancelled = true;
    };
  });

  return {
    get value() {
      return palette;
    },
  };
}
