<script lang="ts">
  import { playback, togglePlayPause, skipNext, skipPrevious } from "$lib/state/playback.svelte";

  interface Props {
    hovering: boolean;
  }
  let { hovering }: Props = $props();

  function handlePrevious(e: MouseEvent): void {
    e.stopPropagation();
    skipPrevious();
  }
  function handlePlayPause(e: MouseEvent): void {
    e.stopPropagation();
    togglePlayPause();
  }
  function handleNext(e: MouseEvent): void {
    e.stopPropagation();
    skipNext();
  }
</script>

<!-- One overlay spans cover art + metadata together (darken/blur both as a
     single effect, matching how the user described it) rather than two
     separate per-region effects — simpler and avoids having to track the
     cover/metadata split's exact pixel bounds, which is viewport-relative
     and split across two sibling components. -->
<div
  class="absolute inset-0 z-20 flex items-center justify-center"
  class:pointer-events-none={!hovering}
  style="
    background: rgba(0, 0, 0, {hovering ? 0.4 : 0});
    backdrop-filter: {hovering ? "blur(10px)" : "none"};
    -webkit-backdrop-filter: {hovering ? "blur(10px)" : "none"};
    transition: background-color 0.25s ease;
  "
>
  <div class="flex items-center gap-[clamp(16px,4vw,32px)]" style="opacity: {hovering ? 1 : 0}; transition: opacity 0.2s ease;">
    <button type="button" class="control-btn" onclick={handlePrevious} aria-label="Previous track">
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-[45%] w-[45%]">
        <polygon points="19 20 9 12 19 4 19 20" />
        <rect x="5" y="4" width="2.4" height="16" />
      </svg>
    </button>

    <button
      type="button"
      class="control-btn control-btn-primary"
      style="background-color: var(--accent-color);"
      onclick={handlePlayPause}
      aria-label={playback.isPlaying ? "Pause" : "Play"}
    >
      {#if playback.isPlaying}
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-[38%] w-[38%]">
          <rect x="6" y="4" width="4.5" height="16" />
          <rect x="13.5" y="4" width="4.5" height="16" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-[40%] w-[40%] translate-x-[6%]">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      {/if}
    </button>

    <button type="button" class="control-btn" onclick={handleNext} aria-label="Next track">
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-[45%] w-[45%]">
        <polygon points="5 4 15 12 5 20 5 4" />
        <rect x="16.6" y="4" width="2.4" height="16" />
      </svg>
    </button>
  </div>
</div>

<style>
  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(38px, 7vh, 54px);
    height: clamp(38px, 7vh, 54px);
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      background-color 0.15s ease;
  }
  .control-btn:hover {
    background: rgba(255, 255, 255, 0.26);
    transform: scale(1.07);
  }
  .control-btn-primary {
    width: clamp(52px, 9.5vh, 72px);
    height: clamp(52px, 9.5vh, 72px);
    border: none;
    color: black;
  }
  .control-btn-primary:hover {
    filter: brightness(1.1);
    transform: scale(1.07);
  }
</style>
