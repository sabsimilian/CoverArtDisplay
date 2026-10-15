<script lang="ts">
  import type { Snippet } from "svelte";
  import { settings } from "$lib/state/settings.svelte";
  import type { CoverPalette } from "$lib/utils/cover-palette.svelte";

  interface Props {
    palette: CoverPalette;
    children?: Snippet;
  }
  let { palette, children }: Props = $props();

  // The layout is drawn for the portrait kiosk's 600x1076 viewport and
  // zoomed to fit any other window size, so proportions never change.
  const WIDTH = 600;
  const HEIGHT = 1076;

  // Burn-in protection: nudge everything by a few px once a minute.
  const SHIFTS = ["0px, 0px", "3px, -2px", "-2px, 3px", "2px, 2px", "-3px, -1px"];
  const SHIFT_MS = 60000;

  let shiftIndex = $state(0);
  let innerWidth = $state(WIDTH);
  let innerHeight = $state(HEIGHT);
  const zoom = $derived(Math.min(innerWidth / WIDTH, innerHeight / HEIGHT));

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
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<!-- Root paints the panel colour edge to edge, so the burn-in shift and any
     letterboxing from the zoom show panel colour rather than the desktop. -->
<div
  class="flex h-screen w-screen items-start justify-center overflow-hidden text-white"
  style="background: {palette.panel}; transition: background 0.9s ease; font-family: var(--app-font-family);"
>
  <div
    class="flex shrink-0 flex-col"
    style="width: {WIDTH}px; height: {HEIGHT}px; zoom: {zoom}; transform: translate({SHIFTS[shiftIndex]}); transition: transform 2s ease-in-out;"
  >
    {@render children?.()}
  </div>
</div>
