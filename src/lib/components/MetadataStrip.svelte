<script lang="ts">
  import type { Snippet } from "svelte";
  import { settings, backgroundStyle } from "$lib/state/settings.svelte";
  import { getCoverGradient } from "$lib/utils/colorthief";

  interface Props {
    coverUrl: string;
    align?: "center" | "left";
    height?: string;
    children?: Snippet;
  }
  let { coverUrl, align = "center", height = "auto", children }: Props = $props();

  let gradient = $state<string | null>(null);

  const style = $derived(backgroundStyle(settings.value));

  // Only Gradient extracts a colorthief palette now — Cover Image used to
  // share this (as a base sitting under the blurred cover at 65% opacity),
  // but that made the extracted palette's own colors dominate and the two
  // styles ended up looking nearly identical. Cover Image is supposed to
  // read as "the actual cover art, extended outward and blurred" — an image
  // effect, not a color effect — so it needs the real photo at high opacity,
  // not colorthief's abstraction of it.
  $effect(() => {
    const url = coverUrl;
    const currentStyle = style;
    if (currentStyle !== "gradient" || !url) {
      gradient = null;
      return;
    }
    let cancelled = false;
    getCoverGradient(url).then((g) => {
      if (!cancelled) gradient = g;
    });
    return () => {
      cancelled = true;
    };
  });

  // The base layer always paints a background (matches the OG app: it sets
  // this baseline on every style, not just Static). Only Gradient uses the
  // extracted palette; Static AND Cover Image both use the plain user-picked
  // color — Cover Image's base is just a neutral backing behind the blurred
  // cover (see below), never meant to be visible or notable on its own.
  const baseBg = $derived.by((): { color: string; image: string } => {
    if (style === "gradient") {
      return gradient ? { color: "", image: gradient } : { color: settings.value.areaUnderCoverBgColor, image: "" };
    }
    return { color: settings.value.areaUnderCoverBgColor, image: "" };
  });
</script>

<div class="relative w-full shrink-0 overflow-hidden" style="height: {height};">
  <div
    class="absolute inset-0"
    style="
      background-color: {baseBg.color};
      background-image: {baseBg.image};
      background-size: cover;
      background-position: center;
      opacity: var(--area-bg-opacity, 1);
      transition: background-color 0.5s ease, opacity 0.3s ease;
    "
  >
    {#if style === "coverimage" && coverUrl}
      <!-- Near-opaque (0.96, not 1) — the real point is for this to read as
           "the cover art itself, extending outward and blurred" the way a
           Spotify-style now-playing backdrop does, not a subtle tint. It's
           scaled up 1.15x so blur()'s softened edges fall outside the
           clipped (overflow:hidden) strip instead of showing as a
           washed-out border. Opacity is baked into the filter function,
           never the `opacity` property — combining that with blur() on one
           element is what made this look "stuck" (unaffected by the
           Transparent toggle) before. -->
      <div
        class="absolute inset-0 scale-[1.15]"
        style="
          background-image: url('{coverUrl}');
          background-size: cover;
          background-position: center;
          filter: blur(40px) brightness(0.55) saturate(1.15) opacity(0.96);
        "
      ></div>
    {/if}
  </div>

  <!-- Outer box owns the padding only; the inner box is the actual marquee
       clip boundary (no padding of its own, so its edge lines up exactly
       with the visible inset area) — ported from the OG app's
       #metadataContainer/#metadataInner split for the same reason: CSS
       `overflow: hidden` clips at the padding box, so if the clipping
       element itself had horizontal padding, scrolling text could still
       render into it and reach the true edge before getting cut off.
       Padding itself is also a direct port of the OG app's exact clamp()
       values, not a fixed Tailwind spacing step. -->
  <div class="relative z-10 h-full w-full" style="padding: clamp(10px, 2.5vh, 22px) clamp(12px, 3vw, 28px);">
    <div
      class="flex h-full w-full flex-col justify-center overflow-hidden"
      style="gap: clamp(2px, 0.6vh, 6px);"
      class:items-center={align === "center"}
      class:text-center={align === "center"}
      class:items-start={align === "left"}
      class:text-left={align === "left"}
    >
      {@render children?.()}
    </div>
  </div>
</div>
