<script lang="ts">
  import { untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { playback } from "$lib/state/playback.svelte";
  import { widget, syncWidgetIdleShuffle } from "$lib/state/widget.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import MetadataStrip from "$lib/components/MetadataStrip.svelte";
  import PlaybackControls from "$lib/components/PlaybackControls.svelte";
  import NowPlayingProgressBar from "$lib/components/NowPlayingProgressBar.svelte";
  import { marquee } from "$lib/actions/marquee";
  import { openSettingsModal } from "$lib/state/settings-modal.svelte";

  let hovering = $state(false);

  // Widget mode has no idle-mode picker of its own — whenever nothing is
  // playing it always falls back to random saved-album art (see widget.svelte.ts).
  // Keep that shuffle in sync with playback state / interval changes while
  // this view is mounted (mirrors V1's updateWidgetIdleState). untrack() is
  // load-bearing here for the same reason it is in StandbyView.svelte — see
  // that file's comment.
  $effect(() => {
    playback.isPlaying;
    settings.value.mediaChangeInterval;
    untrack(() => syncWidgetIdleShuffle());
  });

  const track = $derived(playback.currentTrack);
  const idleAlbum = $derived(widget.idleAlbum);

  const coverUrl = $derived(playback.isPlaying ? (track?.coverUrl ?? "") : (idleAlbum?.images?.[0]?.url ?? ""));
  const title = $derived(playback.isPlaying ? (track?.name ?? "Not playing") : (idleAlbum?.name ?? "Not playing"));
  const subtitle = $derived(playback.isPlaying ? (track?.artist ?? "") : idleAlbum ? `by ${idleAlbum.artists}` : "");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative flex h-screen w-screen flex-col overflow-hidden"
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
>
  <div class="relative min-h-0 w-full flex-1 overflow-hidden">
    {#if coverUrl}
      {#key coverUrl}
        <img
          src={coverUrl}
          alt=""
          crossorigin="anonymous"
          class="absolute inset-0 h-full w-full object-cover"
          transition:fade={{ duration: 350 }}
        />
      {/key}
    {/if}
  </div>

  <!-- Only during actual playback — while idle, coverUrl/title come from a
       random saved album (see idleAlbum above), which has no real progress
       to show; playback.currentTrack would just be stale leftovers from the
       last real session. -->
  {#if playback.isPlaying && settings.value.progressBarEnabled}
    <NowPlayingProgressBar />
  {/if}

  <!-- Clicking the info area opens Settings — the widget window is too small
       to host a gear menu of its own, so this doubles as its access point. -->
  <button type="button" class="w-full flex-shrink-0 cursor-pointer text-left" onclick={() => openSettingsModal()}>
    <MetadataStrip {coverUrl} height="auto">
      <div
        class="w-full font-bold whitespace-nowrap"
        style="font-size: clamp(13px, 6vh, 30px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
        use:marquee={title}
      >
        {title}
      </div>
      <div
        class="w-full font-normal whitespace-nowrap"
        style="font-size: clamp(11px, 4.5vh, 22px); font-family: var(--app-font-family); letter-spacing: -0.01em; line-height: 1.15; color: var(--text-color); opacity: var(--text-opacity);"
        use:marquee={subtitle}
      >
        {subtitle}
      </div>
    </MetadataStrip>
  </button>

  {#if settings.value.controlsEnabled}
    <PlaybackControls {hovering} />
  {/if}
</div>
