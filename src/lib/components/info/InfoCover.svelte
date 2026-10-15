<script lang="ts">
  import { fade } from "svelte/transition";

  interface Props {
    coverUrl: string;
    dim?: boolean;
    children?: import("svelte").Snippet;
  }
  let { coverUrl, dim = false, children }: Props = $props();
</script>

<!-- 600x600 square at the top. Outgoing and incoming covers overlap while
     they crossfade, as in CoverArt.svelte. -->
<div class="relative shrink-0 overflow-hidden bg-black" style="width: 600px; height: 600px;">
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
