<script lang="ts">
  import { untrack } from "svelte";
  import { playback } from "$lib/state/playback.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import { trackExtras, fetchTrackExtras, forgetTrack } from "$lib/state/track-extras.svelte";
  import { weather, watchWeather } from "$lib/state/weather.svelte";
  import { loadedImage } from "$lib/utils/loaded-image.svelte";
  import { coverPalette } from "$lib/utils/cover-palette.svelte";
  import { fitPanel } from "$lib/utils/fit-panel.svelte";
  import { ticking, formatClock, formatTrackTime } from "$lib/utils/now.svelte";
  import { marquee } from "$lib/actions/marquee";
  import InfoFrame from "./InfoFrame.svelte";
  import InfoCover from "./InfoCover.svelte";
  import type { TrackInfo } from "$lib/tauri/types";

  // Text swaps while the panel is faded out on a track change.
  const SWAP_MS = 450;
  const UP_NEXT_ROWS = 2;

  const track = $derived(playback.currentTrack);
  const cover = loadedImage(() => track?.coverUrl ?? "");
  const palette = coverPalette(() => cover.url);
  const now = ticking(1000);

  // `shown` is the track whose text is on the panel. It lags the real track
  // by SWAP_MS on a change, so the old text fades out before the new arrives.
  let shown = $state<TrackInfo | null>(untrack(() => playback.currentTrack));
  let fading = $state(false);

  $effect(() => {
    const next = track;
    const current = untrack(() => shown);
    if (!next || next.id === current?.id) {
      if (next) shown = next;
      return;
    }
    fading = true;
    const id = setTimeout(() => {
      if (current?.id) forgetTrack(current.id);
      shown = next;
      fading = false;
    }, SWAP_MS);
    return () => clearTimeout(id);
  });

  $effect(() => {
    if (track) fetchTrackExtras(track, settings.value.showUpNext);
  });

  $effect(() => {
    if (!settings.value.showWeather) return;
    return watchWeather(settings.value.weatherLocation);
  });

  // Polls are up to 10s apart, so progress is extrapolated between them.
  let receivedAt = $state(Date.now());
  $effect(() => {
    void track;
    receivedAt = Date.now();
  });
  const progressMs = $derived.by(() => {
    if (!track) return 0;
    const elapsed = playback.isPlaying ? now.value.getTime() - receivedAt : 0;
    return Math.min(track.durationMs, track.progressMs + Math.max(0, elapsed));
  });
  const fraction = $derived(track && track.durationMs > 0 ? progressMs / track.durationMs : 0);

  const year = $derived(shown?.releaseDate.slice(0, 4) ?? "");
  const album = $derived(shown ? trackExtras.album(shown.albumId) : undefined);
  const liked = $derived(shown ? trackExtras.liked(shown.id) : false);
  const queue = $derived(
    shown && settings.value.showUpNext ? trackExtras.queue(shown.id).slice(0, UP_NEXT_ROWS) : [],
  );

  const CONTEXT_TYPES: Record<string, string> = {
    playlist: "Playlist",
    album: "Album",
    artist: "Artist",
    show: "Podcast",
    collection: "Liked Songs",
  };
  const upNextHeader = $derived.by(() => {
    const type = shown?.contextType ? CONTEXT_TYPES[shown.contextType] : undefined;
    if (!type) return "Up next";
    // An empty or missing name (lookup failed or still pending) drops ": name".
    const name = shown?.contextUri ? trackExtras.contextName(shown.contextUri) : undefined;
    return name ? `Up next · ${type}: ${name}` : `Up next · ${type}`;
  });

  const DEVICE_TYPES: Record<string, string> = {
    CastAudio: "Cast",
    CastVideo: "Chromecast",
    AudioDongle: "Speaker",
    AVR: "Receiver",
    STB: "TV box",
  };
  // "Speaker · Shuffle on", under the device name. (On the same line, it
  // would be cut short by the date and weather beside it at these sizes.)
  const deviceDetails = $derived.by(() => {
    if (!track) return "";
    const parts = [DEVICE_TYPES[track.deviceType] ?? track.deviceType, track.shuffle ? "Shuffle on" : "Shuffle off"];
    if (track.repeat === "track") parts.push("Repeat track");
    else if (track.repeat === "context") parts.push("Repeat on");
    return parts.filter(Boolean).join(" · ");
  });

  const dateShort = $derived(now.value.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }));
  const dateLine = $derived(
    settings.value.showWeather && weather.label ? `${dateShort} · ${weather.label}` : dateShort,
  );

  // Hidden when the panel overflows, in this order: the ℗ line, the second
  // up-next row, then the whole up-next block.
  const fit = fitPanel(3, () => [shown?.id, album?.label, queue.length, upNextHeader, dateLine, settings.value.textSize]);
  const showLabel = $derived(fit.level < 1);
  const upNextRows = $derived(fit.level < 2 ? queue : queue.slice(0, 1));
  const showUpNext = $derived(fit.level < 3 && queue.length > 0);

  const u = (n: number) => `calc(${n} * var(--u))`;
</script>

<InfoFrame palette={palette.value}>
  <InfoCover coverUrl={cover.url} />

  <div class="w-full shrink-0" style="height: {u(8)}; background: {palette.value.track}; transition: background 0.9s ease;">
    <div
      class="h-full"
      style="width: {fraction * 100}%; background: {palette.value.accent}; transition: background 0.9s ease, width {playback.isPlaying ? 1 : 0}s linear;"
    ></div>
  </div>

  <div
    bind:this={fit.panel}
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    style="padding: {u(28)} {u(32)}; opacity: {fading ? 0 : 1}; transform: translateY({u(fading ? 10 : 0)}); transition: opacity 0.4s ease, transform 0.45s ease;"
  >
    {#if shown}
      <div
        class="flex shrink-0 items-baseline justify-between uppercase"
        style="gap: {u(12)}; font-size: {u(20)}; font-weight: 700; letter-spacing: 0.1em; line-height: 1.2; color: {palette.value.accent}; transition: color 0.9s ease;"
      >
        <span class="truncate">{shown.albumName}{year ? ` · ${year}` : ""}</span>
        {#if shown.trackNumber && shown.totalTracks}
          <span class="shrink-0 tabular-nums">Track {shown.trackNumber} / {shown.totalTracks}</span>
        {/if}
      </div>

      <div class="flex min-w-0 shrink-0 items-center" style="margin-top: {u(8)}; gap: {u(16)};">
        <div class="min-w-0 flex-1 overflow-hidden">
          <div class="whitespace-nowrap" style="font-size: {u(76)}; font-weight: 900; letter-spacing: -0.025em; line-height: 1.15;" use:marquee={shown.name}>
            {shown.name}
          </div>
        </div>
        {#if liked}
          <svg viewBox="0 0 24 24" class="shrink-0" style="width: {u(40)}; height: {u(40)}; color: {palette.value.accent};" aria-label="In your Liked Songs">
            <path
              fill="currentColor"
              d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.4 1.2 6 3.6 2.6-2.4 3.8-3.6 6-3.6 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"
            ></path>
          </svg>
        {/if}
      </div>

      <div class="shrink-0 overflow-hidden" style="margin-top: {u(4)};">
        <div class="whitespace-nowrap" style="font-size: {u(32)}; font-weight: 500; line-height: 1.3; color: rgba(255,255,255,0.8);" use:marquee={shown.artist}>
          {shown.artist}
        </div>
      </div>

      {#if showLabel && album?.label}
        <div class="shrink-0 truncate" style="margin-top: {u(8)}; font-size: {u(18)}; line-height: 1.3; color: rgba(255,255,255,0.7);">
          ℗ {year} {album.label}
        </div>
      {/if}

      <div class="flex-1"></div>

      {#if showUpNext}
        <div
          class="flex shrink-0 flex-col"
          style="padding: {u(14)} 0; gap: {u(8)}; border-top: 1px solid rgba(255,255,255,0.2); border-bottom: 1px solid rgba(255,255,255,0.2);"
        >
          <div class="truncate uppercase" style="font-size: {u(18)}; font-weight: 700; letter-spacing: 0.1em; line-height: 1.2; color: rgba(255,255,255,0.7);">
            {upNextHeader}
          </div>
          {#each upNextRows as item, i}
            <div class="grid" style="grid-template-columns: {u(32)} minmax(0, 1fr); font-size: {u(24)}; line-height: 1.3;">
              <span class="tabular-nums" style="color: rgba(255,255,255,0.55);">{i + 1}</span>
              <span class="truncate" style="font-weight: 600;">
                {item.name}
                {#if item.artist}<span style="font-weight: 400; color: rgba(255,255,255,0.7);">— {item.artist}</span>{/if}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    {#if track}
      <div class="flex shrink-0 items-end justify-between" style="margin-top: {u(16)}; gap: {u(16)};">
        <div class="flex min-w-0 flex-col" style="gap: {u(4)}; font-size: {u(22)}; line-height: 1.25;">
          {#if track.deviceName}
            <span class="flex min-w-0 items-center" style="gap: {u(10)}; font-weight: 600;">
              <span class="shrink-0 rounded-full" style="width: {u(12)}; height: {u(12)}; background: {palette.value.accent};"></span>
              <span class="truncate">{track.deviceName}</span>
            </span>
          {/if}
          {#if deviceDetails}
            <span class="truncate" style="color: rgba(255,255,255,0.7);">{deviceDetails}</span>
          {/if}
          <span class="tabular-nums" style="font-weight: 500; color: rgba(255,255,255,0.7);">
            {formatTrackTime(progressMs)} / {formatTrackTime(track.durationMs)}
          </span>
        </div>

        <div class="flex shrink-0 flex-col items-end text-right" style="gap: {u(4)};">
          {#if settings.value.ambientClockEnabled}
            <span class="tabular-nums" style="font-size: {u(72)}; font-weight: 300; line-height: 0.9;">{formatClock(now.value)}</span>
          {/if}
          <span style="font-size: {u(22)}; font-weight: 500; line-height: 1.25; color: rgba(255,255,255,0.75);">{dateLine}</span>
        </div>
      </div>
    {/if}
  </div>
</InfoFrame>
