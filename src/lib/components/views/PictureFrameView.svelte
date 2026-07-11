<script lang="ts">
  import { fade } from "svelte/transition";
  import { standby } from "$lib/state/standby.svelte";
  import { settings } from "$lib/state/settings.svelte";

  const photoUrl = $derived(standby.currentPhotoUrl);
  const grayscale = $derived(settings.value.pictureFrameBW ? "100%" : "0%");
</script>

<!-- Always opaque, unlike the other idle modes — Picture Frame is meant to
     look like an actual photo frame, not show the desktop through it. -->
<div class="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
  {#if photoUrl}
    {#key photoUrl}
      <img
        src={photoUrl}
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        style="filter: blur(10px) grayscale({grayscale});"
        transition:fade={{ duration: 350 }}
      />
    {/key}
    {#key photoUrl}
      <img
        src={photoUrl}
        alt=""
        class="absolute inset-0 z-10 m-auto block max-h-[90vh] max-w-[90vw]"
        style="filter: drop-shadow(16px 16px 20px black) grayscale({grayscale});"
        transition:fade={{ duration: 350 }}
      />
    {/key}
  {:else}
    <div class="flex flex-col items-center gap-4 text-center text-white/60">
      <span class="text-5xl">🖼️</span>
      <p class="text-2xl">No photos available</p>
      <p class="text-base opacity-70">Add photo folders in settings</p>
    </div>
  {/if}
</div>
