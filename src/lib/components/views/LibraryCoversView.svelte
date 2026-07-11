<script lang="ts">
  import { standby } from "$lib/state/standby.svelte";
  import MetadataStrip from "$lib/components/MetadataStrip.svelte";
  import CoverArt from "$lib/components/CoverArt.svelte";
  import { marquee } from "$lib/actions/marquee";

  const album = $derived(standby.currentAlbum);
  const coverUrl = $derived(album?.images?.[0]?.url ?? "");
  const artistLabel = $derived(album ? `by ${album.artists}` : "");
  const year = $derived(album?.release_date ? album.release_date.split("-")[0] : "");
</script>

<!-- Same cover-fills-above-strip layout as PlayerView/WidgetView. -->
<div class="flex h-screen w-screen flex-col overflow-hidden">
  <CoverArt {coverUrl} />

  <MetadataStrip {coverUrl} align="left">
    <div
      class="w-full font-bold whitespace-nowrap"
      style="font-size: clamp(13px, 5.5vh, 52px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
      use:marquee={album?.name ?? ""}
    >
      {album?.name ?? ""}
    </div>
    <div
      class="w-full font-normal whitespace-nowrap"
      style="font-size: clamp(11px, 4vh, 38px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
      use:marquee={artistLabel}
    >
      {artistLabel}
    </div>
    <div
      class="w-full font-normal whitespace-nowrap"
      style="font-size: clamp(10px, 3.5vh, 32px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
      use:marquee={year}
    >
      {year}
    </div>
  </MetadataStrip>
</div>
