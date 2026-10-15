<script lang="ts">
  import type { Snippet } from "svelte";
  import { settings, TEXT_SIZES } from "$lib/state/settings.svelte";
  import type { CoverPalette } from "$lib/utils/cover-palette.svelte";

  interface Props {
    palette: CoverPalette;
    children?: Snippet;
  }
  let { palette, children }: Props = $props();

  // The layout is drawn for the portrait kiosk's 600px-wide viewport. Every
  // size is written in u: --u0 is one design px at the window's width, and
  // --u is that times the Text size setting. The cover (and the burn-in
  // shift) use --u0, so a bigger text size never pushes the cover past the
  // window edge.
  const textScale = $derived(TEXT_SIZES[settings.value.textSize] ?? 1);

  // Burn-in protection: nudge everything by a few px once a minute.
  const SHIFTS = [
    [0, 0],
    [3, -2],
    [-2, 3],
    [2, 2],
    [-3, -1],
  ];
  const SHIFT_MS = 60000;

  let shiftIndex = $state(0);

  $effect(() => {
    if (!settings.value.burnInShift) {
      shiftIndex = 0;
      return;
    }
    const id = setInterval(() => {
      shiftIndex = (shiftIndex + 1) % SHIFTS.length;
    }, SHIFT_MS);
    return () => clearInterval(id);
  });

  const [shiftX, shiftY] = $derived(SHIFTS[shiftIndex]);
</script>

<!-- Root paints the panel colour edge to edge, so the burn-in shift shows
     panel colour rather than the desktop. -->
<div
  class="h-screen w-screen overflow-hidden text-white"
  style="--u0: calc(100vw / 600); --u: calc(var(--u0) * {textScale}); background: {palette.panel}; transition: background 0.9s ease; font-family: var(--app-font-family);"
>
  <div
    class="flex h-full w-full flex-col"
    style="transform: translate(calc({shiftX} * var(--u0)), calc({shiftY} * var(--u0))); transition: transform 2s ease-in-out;"
  >
    {@render children?.()}
  </div>
</div>
