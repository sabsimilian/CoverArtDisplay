<script lang="ts">
  import { standby } from "$lib/state/standby.svelte";
  import { playback } from "$lib/state/playback.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import { trackExtras, fetchLastPlayed } from "$lib/state/track-extras.svelte";
  import { weather, watchWeather } from "$lib/state/weather.svelte";
  import { loadedImage } from "$lib/utils/loaded-image.svelte";
  import { coverPalette } from "$lib/utils/cover-palette.svelte";
  import { ticking, formatClock, formatAgo } from "$lib/utils/now.svelte";
  import InfoFrame from "./InfoFrame.svelte";
  import InfoCover from "./InfoCover.svelte";

  const album = $derived(standby.currentAlbum);
  const cover = loadedImage(() => album?.images?.[0]?.url ?? "");
  const palette = coverPalette(() => cover.url);
  const now = ticking(1000);

  // Once per visit to standby: it only changes when something plays, which
  // takes us out of this view anyway.
  $effect(() => {
    fetchLastPlayed();
  });

  $effect(() => {
    if (!settings.value.showWeather) return;
    return watchWeather(settings.value.weatherLocation);
  });

  const lastPlayed = $derived(trackExtras.lastPlayed);
  const lastPlayedAgo = $derived(lastPlayed?.playedAt ? formatAgo(new Date(lastPlayed.playedAt), now.value) : "");
  const dateLabel = $derived(now.value.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
</script>

<InfoFrame palette={palette.value}>
  <InfoCover coverUrl={cover.url} dim>
    {#if album}
      <div
        class="absolute flex flex-col gap-0.5 rounded-[10px]"
        style="left: 20px; bottom: 20px; max-width: 420px; padding: 10px 14px; background: rgba(0,0,0,0.45); backdrop-filter: blur(12px); line-height: 1.3;"
      >
        <span class="uppercase" style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: rgba(255,255,255,0.6);">
          From your library
        </span>
        <span style="font-size: 16px; font-weight: 600;">{album.name} — {album.artists}</span>
      </div>
    {/if}
  </InfoCover>

  <div class="h-[5px] w-full shrink-0" style="background: {palette.value.track}; transition: background 0.9s ease;"></div>

  <div class="flex min-h-0 flex-1 flex-col" style="padding: 40px 36px 34px;">
    <div
      class="uppercase"
      style="font-size: 15px; font-weight: 700; letter-spacing: 0.14em; color: {palette.value.accent}; transition: color 0.9s ease;"
    >
      Nothing playing
    </div>
    <div class="tabular-nums" style="margin-top: 14px; font-size: 150px; font-weight: 300; letter-spacing: -0.04em; line-height: 0.95;">
      {formatClock(now.value)}
    </div>
    <div style="margin-top: 14px; font-size: 26px; font-weight: 500; color: rgba(255,255,255,0.8);">{dateLabel}</div>
    {#if settings.value.showWeather && weather.label}
      <div style="margin-top: 6px; font-size: 20px; font-weight: 400; color: rgba(255,255,255,0.6);">{weather.label}</div>
    {/if}

    {#if lastPlayed || playback.lastDeviceName}
      <div
        class="mt-auto grid"
        style="padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.14); grid-template-columns: 110px minmax(0, 1fr); row-gap: 8px; font-size: 16px; line-height: 1.3;"
      >
        {#if lastPlayed}
          <span style="color: rgba(255,255,255,0.5);">Last played</span>
          <span class="truncate" style="font-weight: 600;">
            {lastPlayed.name}
            <span style="font-weight: 400; color: rgba(255,255,255,0.6);">— {lastPlayed.artist}{lastPlayedAgo ? ` · ${lastPlayedAgo}` : ""}</span>
          </span>
        {/if}
        {#if playback.lastDeviceName}
          <span style="color: rgba(255,255,255,0.5);">Speaker</span>
          <span class="truncate" style="font-weight: 600;">
            {playback.lastDeviceName} <span style="font-weight: 400; color: rgba(255,255,255,0.6);">· idle</span>
          </span>
        {/if}
      </div>
    {/if}
  </div>
</InfoFrame>
