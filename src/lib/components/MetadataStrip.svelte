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

  // Cover Image also extracts a palette, same as Gradient — using the plain
  // static color as its base made the "color mixed with cover art" look too
  // subtle/muddy to actually notice next to Gradient's own vibrant colors,
  // especially with the default near-black background color. The extracted
  // palette is far more consistently visible regardless of that setting.
  $effect(() => {
    const url = coverUrl;
    const currentStyle = style;
    if ((currentStyle !== "gradient" && currentStyle !== "coverimage") || !url) {
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
  // this baseline on every style, not just Static). Gradient and Cover Image
  // both use the extracted palette; Static uses the plain user-picked color.
  // Cover Image layers the blurred cover on top as a CHILD, at a fixed 65%
  // opacity (baked into the filter function, never the `opacity` property —
  // combining that with `blur()` on one element is what made this look stuck
  // before), so the vibrant base color always shows through the blur
  // clearly, regardless of the Transparent toggle. Transparent then fades the
  // *whole group* (color + blurred cover together) toward the
  // OS-transparent window, rather than replacing the mixed look with plain
  // see-through.
  const baseBg = $derived.by((): { color: string; image: string } => {
    if (style === "gradient" || style === "coverimage") {
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
      <div
        class="absolute inset-0 scale-[1.15]"
        style="
          background-image: url('{coverUrl}');
          background-size: cover;
          background-position: center;
          filter: blur(40px) brightness(0.55) saturate(1.15) opacity(0.65);
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
