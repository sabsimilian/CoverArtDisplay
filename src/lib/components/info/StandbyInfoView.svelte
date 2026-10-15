<script lang="ts">
  import { standby } from "$lib/state/standby.svelte";
  import { playback } from "$lib/state/playback.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import { trackExtras, fetchLastPlayed } from "$lib/state/track-extras.svelte";
  import { weather, watchWeather } from "$lib/state/weather.svelte";
  import { loadedImage } from "$lib/utils/loaded-image.svelte";
  import { coverPalette } from "$lib/utils/cover-palette.svelte";
  import { ticking, formatClock, formatAgo } from "$lib/utils/now.svelte";
  import { fitPanel } from "$lib/utils/fit-panel.svelte";
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

  // At larger text sizes the bottom rows may not fit: drop Speaker, then
  // Last played, rather than shrink the clock.
  const fit = fitPanel(2, () => [lastPlayed, playback.lastDeviceName, weather.label, settings.value.textSize]);
  const showSpeaker = $derived(fit.level < 1 && !!playback.lastDeviceName);
  const showLastPlayed = $derived(fit.level < 2 && !!lastPlayed);

  const u = (n: number) => `calc(${n} * var(--u))`;
</script>

<InfoFrame palette={palette.value}>
  <InfoCover coverUrl={cover.url} dim>
    {#if album}
      <div
        class="absolute flex flex-col"
        style="left: {u(20)}; bottom: {u(20)}; max-width: calc(100% - {u(40)}); gap: {u(2)}; padding: {u(12)} {u(16)}; border-radius: {u(10)}; background: rgba(0,0,0,0.45); backdrop-filter: blur(12px); line-height: 1.3;"
      >
        <span class="uppercase" style="font-size: {u(14)}; font-weight: 700; letter-spacing: 0.12em; color: rgba(255,255,255,0.7);">
          From your library
        </span>
        <span class="truncate" style="font-size: {u(20)}; font-weight: 600;">{album.name} — {album.artists}</span>
      </div>
    {/if}
  </InfoCover>

  <div class="w-full shrink-0" style="height: {u(8)}; background: {palette.value.track}; transition: background 0.9s ease;"></div>

  <div bind:this={fit.panel} class="flex min-h-0 flex-1 flex-col overflow-hidden" style="padding: {u(40)} {u(32)} {u(34)};">
    <div
      class="shrink-0 uppercase"
      style="font-size: {u(20)}; font-weight: 700; letter-spacing: 0.1em; line-height: 1.2; color: {palette.value.accent}; transition: color 0.9s ease;"
    >
      Nothing playing
    </div>
    <div class="shrink-0 tabular-nums" style="margin-top: {u(14)}; font-size: {u(180)}; font-weight: 300; letter-spacing: -0.04em; line-height: 0.95;">
      {formatClock(now.value)}
    </div>
    <div class="shrink-0" style="margin-top: {u(14)}; font-size: {u(32)}; font-weight: 500; line-height: 1.25; color: rgba(255,255,255,0.8);">{dateLabel}</div>
    {#if settings.value.showWeather && weather.label}
      <div class="shrink-0" style="margin-top: {u(6)}; font-size: {u(26)}; line-height: 1.25; color: rgba(255,255,255,0.7);">{weather.label}</div>
    {/if}

    {#if showLastPlayed || showSpeaker}
      <div
        class="mt-auto grid shrink-0"
        style="padding-top: {u(16)}; border-top: 1px solid rgba(255,255,255,0.2); grid-template-columns: {u(140)} minmax(0, 1fr); row-gap: {u(8)}; font-size: {u(22)}; line-height: 1.3;"
      >
        {#if showLastPlayed && lastPlayed}
          <span style="color: rgba(255,255,255,0.7);">Last played</span>
          <span class="truncate" style="font-weight: 600;">
            {lastPlayed.name}
            <span style="font-weight: 400; color: rgba(255,255,255,0.7);">— {lastPlayed.artist}{lastPlayedAgo ? ` · ${lastPlayedAgo}` : ""}</span>
          </span>
        {/if}
        {#if showSpeaker}
          <span style="color: rgba(255,255,255,0.7);">Speaker</span>
          <span class="truncate" style="font-weight: 600;">
            {playback.lastDeviceName} <span style="font-weight: 400; color: rgba(255,255,255,0.7);">· idle</span>
          </span>
        {/if}
      </div>
    {/if}
  </div>
</InfoFrame>
