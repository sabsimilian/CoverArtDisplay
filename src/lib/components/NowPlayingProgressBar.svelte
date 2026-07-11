<script lang="ts">
  import { playback } from "$lib/state/playback.svelte";

  // Matches playback.svelte.ts's poll interval — the CSS transition below is
  // timed to finish exactly as the next real progress value lands, so the
  // fill visibly creeps forward between polls instead of only jumping every
  // 3s.
  const POLL_INTERVAL_S = 3;

  const track = $derived(playback.currentTrack);
  const fraction = $derived(track && track.durationMs > 0 ? Math.min(1, track.progressMs / track.durationMs) : 0);
</script>

<!-- Sits right at the cover/metadata seam: normal-flow (so it's exactly at
     that boundary regardless of either area's height, both of which are
     viewport-relative and unknown here) with a negative margin equal to its
     own height, which pulls the metadata strip up to close the gap — the bar
     then visually overlaps the very top of the metadata area rather than
     adding to the layout height. z-30 keeps it above both MetadataStrip's
     own background layer and PlaybackControls' hover dim/blur (z-20), so it
     stays legible even mid-hover. -->
<div
  class="relative z-30 w-full shrink-0"
  style="height: clamp(2px, 0.35vh, 4px); margin-bottom: calc(-1 * clamp(2px, 0.35vh, 4px)); background-color: color-mix(in srgb, var(--text-color) 22%, transparent);"
>
  {#key track?.id}
    <div
      class="h-full"
      style="
        width: {fraction * 100}%;
        background-color: var(--text-color);
        transition: width {playback.isPlaying ? POLL_INTERVAL_S : 0}s linear;
      "
    ></div>
  {/key}
</div>
