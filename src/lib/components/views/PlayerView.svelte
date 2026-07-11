<script lang="ts">
  import { playback } from "$lib/state/playback.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import MetadataStrip from "$lib/components/MetadataStrip.svelte";
  import CoverArt from "$lib/components/CoverArt.svelte";
  import PlaybackControls from "$lib/components/PlaybackControls.svelte";
  import NowPlayingProgressBar from "$lib/components/NowPlayingProgressBar.svelte";
  import { marquee } from "$lib/actions/marquee";

  const track = $derived(playback.currentTrack);

  let hovering = $state(false);
</script>

<!-- Same cover-fills-above-strip layout as WidgetView/LibraryCoversView — one
     unified shape across every window mode, rather than a fixed-aspect
     letterboxed square. `relative` so PlaybackControls (absolute, inset-0)
     covers cover art + metadata together as one hover target. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative flex h-screen w-screen flex-col overflow-hidden"
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
>
  <CoverArt coverUrl={track?.coverUrl ?? ""} />

  {#if settings.value.controlsEnabled}
    <PlaybackControls {hovering} />
  {/if}

  {#if settings.value.progressBarEnabled}
    <NowPlayingProgressBar />
  {/if}

  <MetadataStrip coverUrl={track?.coverUrl ?? ""}>
    <div
      class="w-full font-bold whitespace-nowrap"
      style="font-size: clamp(14px, 6vh, 56px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
      use:marquee={track?.name ?? ""}
    >
      {track?.name ?? ""}
    </div>
    <div
      class="w-full font-normal whitespace-nowrap"
      style="font-size: clamp(12px, 4.5vh, 42px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
      use:marquee={track?.artist ?? ""}
    >
      {track?.artist ?? ""}
    </div>
    <div
      class="w-full font-normal whitespace-nowrap"
      style="font-size: clamp(11px, 4vh, 38px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
      use:marquee={track?.albumName ?? ""}
    >
      {track?.albumName ?? ""}
    </div>
  </MetadataStrip>
</div>
