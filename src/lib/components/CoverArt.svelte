<script lang="ts">
  import { fade } from "svelte/transition";
  import { settings } from "$lib/state/settings.svelte";

  interface Props {
    coverUrl: string;
  }
  let { coverUrl }: Props = $props();

  const FADE = { duration: 350 };
</script>

<!-- "Style: Default / Fit" (blurStyleEnabled) — ported from the OG app:
     Default fills the whole area edge-to-edge (crops via object-cover, no
     padding). Fit instead shrinks the cover to fit within the area with some
     breathing room around it (object-contain, capped to 90% of each
     dimension, centered) and fills the remaining space behind it with a
     blurred, darkened, stretched copy of the same cover — rather than
     leaving bare background showing around a smaller image.

     Always opaque (bg-black) — the area above the metadata strip should
     never show the OS-transparent window through it, unlike the metadata
     strip itself which has its own dedicated transparency setting. This is
     also the fallback while a cover is still loading, or in the gap before a
     freshly-set background-image paints.

     Every image is absolutely positioned (never laid out in flow) so that
     when coverUrl changes, the outgoing and incoming images can crossfade
     while genuinely overlapping instead of one popping out of a flex/block
     layout the instant the other pops in — that instant swap (particularly
     visible pausing into Library Covers, where the previous session's
     leftover album would flash before the freshly-shuffled one replaced it)
     is what the fade is fixing, not just decoration. {#key} swaps the whole
     element on every URL change so its own transition re-runs each time,
     instead of only firing once on first mount. -->
<div class="relative min-h-0 w-full flex-1 overflow-hidden bg-black">
  {#if coverUrl}
    {#if settings.value.blurStyleEnabled}
      {#key coverUrl}
        <div
          class="absolute inset-0 scale-125 bg-cover bg-center"
          style="background-image: url('{coverUrl}'); filter: blur(40px) brightness(0.55) saturate(1.15);"
          transition:fade={FADE}
        ></div>
      {/key}
      <div class="relative h-full w-full">
        {#key coverUrl}
          <img
            src={coverUrl}
            alt="Album Cover"
            crossorigin="anonymous"
            class="absolute inset-0 m-auto max-h-[90%] max-w-[90%] object-contain drop-shadow-2xl"
            transition:fade={FADE}
          />
        {/key}
      </div>
    {:else}
      {#key coverUrl}
        <img
          src={coverUrl}
          alt="Album Cover"
          crossorigin="anonymous"
          class="absolute inset-0 h-full w-full object-cover"
          transition:fade={FADE}
        />
      {/key}
    {/if}
  {/if}
</div>
