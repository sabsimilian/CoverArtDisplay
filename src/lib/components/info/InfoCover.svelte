<script lang="ts">
  import { fade } from "svelte/transition";

  interface Props {
    coverUrl: string;
    dim?: boolean;
    children?: import("svelte").Snippet;
  }
  let { coverUrl, dim = false, children }: Props = $props();
</script>

<!-- 600u square across the top, always full-bleed: the Default/Fit cover
     style setting only applies to the classic layout. Outgoing and incoming
     covers overlap while they crossfade, as in CoverArt.svelte. -->
<div
  class="relative shrink-0 overflow-hidden bg-black"
  style="width: calc(600 * var(--u0)); height: calc(600 * var(--u0));"
>
  {#if coverUrl}
    {#key coverUrl}
      <img
        src={coverUrl}
        alt="Album cover"
        crossorigin="anonymous"
        class="absolute inset-0 h-full w-full object-cover"
        style={dim ? "filter: brightness(0.85);" : ""}
        transition:fade={{ duration: 600 }}
      />
    {/key}
  {/if}
  {@render children?.()}
</div>
