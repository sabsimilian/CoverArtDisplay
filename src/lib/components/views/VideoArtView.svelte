<script lang="ts">
  import { standby } from "$lib/state/standby.svelte";

  let videoEl: HTMLVideoElement | undefined = $state();

  $effect(() => {
    const url = standby.currentVideoUrl;
    if (videoEl && url) {
      videoEl.src = url;
      videoEl.load();
      videoEl.play().catch(() => {
        // Autoplay can be blocked in some environments — not fatal, just leaves
        // the frame paused rather than auto-advancing (matches V1).
      });
    }
  });
</script>

<div class="flex h-full w-full items-center justify-center overflow-hidden">
  {#if standby.currentVideoUrl}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={videoEl} muted loop playsinline class="h-full w-full object-cover"></video>
  {:else}
    <div class="flex flex-col items-center gap-4 text-center text-white/60">
      <span class="text-5xl">🎬</span>
      <p class="text-2xl">No videos available</p>
      <p class="text-base opacity-70">Add videos in settings</p>
    </div>
  {/if}
</div>
