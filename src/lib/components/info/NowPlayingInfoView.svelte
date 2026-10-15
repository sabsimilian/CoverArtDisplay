<script lang="ts">
  import { untrack } from "svelte";
  import { playback } from "$lib/state/playback.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import { trackExtras, fetchTrackExtras, forgetTrack } from "$lib/state/track-extras.svelte";
  import { weather, watchWeather } from "$lib/state/weather.svelte";
  import { loadedImage } from "$lib/utils/loaded-image.svelte";
  import { coverPalette } from "$lib/utils/cover-palette.svelte";
  import { ticking, formatClock, formatTrackTime } from "$lib/utils/now.svelte";
  import InfoFrame from "./InfoFrame.svelte";
  import InfoCover from "./InfoCover.svelte";
  import type { TrackInfo } from "$lib/tauri/types";

  // Text swaps while the panel is faded out on a track change.
  const SWAP_MS = 450;

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
  const queue = $derived(shown && settings.value.showUpNext ? trackExtras.queue(shown.id) : []);

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
    if (shown?.contextType === "collection") return `Up next · ${type}`;
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
  const deviceType = $derived(track ? (DEVICE_TYPES[track.deviceType] ?? track.deviceType) : "");
  const modes = $derived.by(() => {
    if (!track) return "";
    const parts = [track.shuffle ? "Shuffle on" : "Shuffle off"];
    if (track.repeat === "track") parts.push("Repeat track");
    else if (track.repeat === "context") parts.push("Repeat on");
    return parts.join(" · ");
  });

  const dateShort = $derived(now.value.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }));
</script>

<InfoFrame palette={palette.value}>
  <InfoCover coverUrl={cover.url} />

  <div class="h-[5px] w-full shrink-0" style="background: {palette.value.track}; transition: background 0.9s ease;">
    <div
      class="h-full"
      style="width: {fraction * 100}%; background: {palette.value.accent}; transition: background 0.9s ease, width {playback.isPlaying ? 1 : 0}s linear;"
    ></div>
  </div>

  <div
    class="flex min-h-0 flex-1 flex-col"
    style="padding: 30px 36px 32px; opacity: {fading ? 0 : 1}; transform: translateY({fading ? 10 : 0}px); transition: opacity 0.4s ease, transform 0.45s ease;"
  >
    {#if shown}
      <div
        class="flex items-baseline justify-between gap-3 uppercase"
        style="font-size: 15px; font-weight: 700; letter-spacing: 0.14em; color: {palette.value.accent}; transition: color 0.9s ease;"
      >
        <span class="truncate">{shown.albumName}{year ? ` · ${year}` : ""}</span>
        {#if shown.trackNumber && shown.totalTracks}
          <span class="shrink-0 tabular-nums">Track {shown.trackNumber} / {shown.totalTracks}</span>
        {/if}
      </div>

      <div class="flex min-w-0 items-center gap-4" style="margin-top: 12px;">
        <div
          class="min-w-0 flex-1 truncate"
          style="font-size: 52px; font-weight: 900; letter-spacing: -0.025em; line-height: 1.22;"
        >
          {shown.name}
        </div>
        {#if liked}
          <svg viewBox="0 0 24 24" width="30" height="30" class="shrink-0" style="color: {palette.value.accent};" aria-label="In your Liked Songs">
            <path
              fill="currentColor"
              d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.4 1.2 6 3.6 2.6-2.4 3.8-3.6 6-3.6 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"
            ></path>
          </svg>
        {/if}
      </div>

      <div style="margin-top: 6px; font-size: 23px; font-weight: 500; line-height: 1.3; color: rgba(255,255,255,0.8); text-wrap: pretty;">
        {shown.artist}
      </div>

      {#if album?.label}
        <div style="margin-top: 8px; font-size: 14px; font-weight: 400; color: rgba(255,255,255,0.5);">
          ℗ {year} {album.label}
        </div>
      {/if}

      <div class="flex-1"></div>

      {#if queue.length > 0}
        <div
          class="flex flex-col"
          style="padding: 14px 0; gap: 7px; border-top: 1px solid rgba(255,255,255,0.14); border-bottom: 1px solid rgba(255,255,255,0.14);"
        >
          <div
            class="truncate uppercase"
            style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; color: rgba(255,255,255,0.5);"
          >
            {upNextHeader}
          </div>
          {#each queue as item, i}
            <div class="grid" style="grid-template-columns: 22px minmax(0, 1fr); font-size: 17px; line-height: 1.3;">
              <span class="tabular-nums" style="color: rgba(255,255,255,0.4);">{i + 1}</span>
              <span class="truncate" style="font-weight: 600;">
                {item.name}
                {#if item.artist}<span style="font-weight: 400; color: rgba(255,255,255,0.6);">— {item.artist}</span>{/if}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    {#if track}
      <div class="flex items-end justify-between gap-4" style="margin-top: 18px;">
        <div class="flex min-w-0 flex-col" style="gap: 7px;">
          {#if track.deviceName}
            <span class="flex min-w-0 items-center gap-2.5" style="font-size: 17px; font-weight: 600;">
              <span class="shrink-0 rounded-full" style="width: 10px; height: 10px; background: {palette.value.accent};"></span>
              <span class="truncate">
                {track.deviceName}
                {#if deviceType}<span style="font-weight: 400; color: rgba(255,255,255,0.6);">· {deviceType}</span>{/if}
              </span>
            </span>
          {/if}
          <span class="flex items-center gap-2.5 tabular-nums" style="font-size: 14px; color: rgba(255,255,255,0.6);">
            {#if track.volumePercent !== undefined}
              <span class="rounded-[2px]" style="width: 100px; height: 4px; background: rgba(255,255,255,0.2);">
                <span class="block h-full rounded-[2px]" style="width: {track.volumePercent}%; background: rgba(255,255,255,0.8);"></span>
              </span>
              <span>{track.volumePercent}%</span>
              <span>·</span>
            {/if}
            <span>{modes}</span>
          </span>
          <span class="tabular-nums" style="font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6);">
            {formatTrackTime(progressMs)} / {formatTrackTime(track.durationMs)}
          </span>
        </div>

        <div class="flex shrink-0 flex-col items-end text-right" style="gap: 5px;">
          {#if settings.value.ambientClockEnabled}
            <span class="tabular-nums" style="font-size: 38px; font-weight: 300; line-height: 1;">{formatClock(now.value)}</span>
          {/if}
          <span style="font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.75);">{dateShort}</span>
          {#if settings.value.showWeather && weather.label}
            <span style="font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6);">{weather.label}</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</InfoFrame>
