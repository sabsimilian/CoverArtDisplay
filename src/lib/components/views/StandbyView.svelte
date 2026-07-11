<script lang="ts">
  import { untrack } from "svelte";
  import { standby, startShuffleFor, stopShuffle } from "$lib/state/standby.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import VideoArtView from "./VideoArtView.svelte";
  import LibraryCoversView from "./LibraryCoversView.svelte";
  import PictureFrameView from "./PictureFrameView.svelte";
  import IdleClock from "$lib/components/IdleClock.svelte";
  import PlaybackControls from "$lib/components/PlaybackControls.svelte";

  // Pausing drops straight into whichever idle mode is selected — without
  // this, there was no way back to Play short of leaving the app and
  // resuming from Spotify itself. Same hover-only overlay as PlayerView, so
  // it stays out of the way of Video Art / Library Covers / Picture Frame
  // until you actually want it.
  let hovering = $state(false);

  // untrack() is load-bearing here, not cosmetic: startShuffleFor() calls
  // into settings.getAllAvailableVideos()/getAllAvailablePhotos(), which read
  // other settings.value fields (videoSources, folderVideos, photoFiles...).
  // Those reads happen synchronously inside this effect's callback, so
  // WITHOUT untrack() Svelte captures them as extra dependencies of this same
  // effect — turning "mode/interval changed" into "any settings field
  // changed", which re-triggers this effect from within its own call stack
  // and blows the effect_update_depth_exceeded guard (freezing the whole
  // page's reactivity, including every click handler — this is what made the
  // gear menu look "unclickable" while an idle mode was showing).
  $effect(() => {
    const mode = standby.activeMode;
    const interval = settings.value.mediaChangeInterval;
    if (mode === "player") return;
    untrack(() => startShuffleFor(mode, interval));
    return () => stopShuffle();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative h-full w-full" onmouseenter={() => (hovering = true)} onmouseleave={() => (hovering = false)}>
  {#if standby.activeMode === "videoart"}
    <VideoArtView />
  {:else if standby.activeMode === "librarycovers"}
    <LibraryCoversView />
  {:else if standby.activeMode === "pictureframe"}
    <PictureFrameView />
  {/if}

  {#if settings.value.controlsEnabled}
    <PlaybackControls {hovering} />
  {/if}

  <IdleClock />
</div>
