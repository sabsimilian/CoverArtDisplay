<script lang="ts">
  import { tick } from "svelte";

  // One line of text that, when it's wider than its box, scrolls left on a
  // continuous loop: a pause with the start of the text in view, then a
  // steady glide until the repeated copy (after a gap) is back where the
  // text started — so the loop has no visible jump. For the info layout,
  // which is read from across a room: the shared marquee action scrolls
  // once per change and then sits cut off with an ellipsis.

  interface Props {
    text: string;
    style?: string;
  }
  let { text, style = "" }: Props = $props();

  // Speed and gap scale with the window width (one design px = 1/600 of it).
  const SPEED_U_PER_S = 50;
  const GAP_EM = 1.5;
  const PAUSE_MS = 2500;

  let box = $state<HTMLElement | null>(null);
  let track = $state<HTMLElement | null>(null);
  let first = $state<HTMLElement | null>(null);
  let overflowing = $state(false);
  let animation: Animation | null = null;

  async function update(): Promise<void> {
    animation?.cancel();
    animation = null;
    if (!box || !first) return;
    overflowing = first.offsetWidth > box.clientWidth + 1;
    await tick();
    if (!overflowing || !track) return;

    const fontPx = parseFloat(getComputedStyle(first).fontSize);
    const distance = first.offsetWidth + fontPx * GAP_EM;
    const scrollMs = (distance / ((SPEED_U_PER_S * window.innerWidth) / 600)) * 1000;
    const total = PAUSE_MS + scrollMs;
    animation = track.animate(
      [
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: PAUSE_MS / total },
        { transform: `translateX(${-distance}px)`, offset: 1 },
      ],
      { duration: total, iterations: Infinity, easing: "linear" },
    );
  }

  // Every poll hands over a new track object, which re-runs effects reading
  // `text` even when the string is unchanged; only a real change restarts
  // the scroll.
  let measuredText: string | null = null;
  $effect(() => {
    if (text === measuredText) return;
    measuredText = text;
    void tick().then(update);
  });

  $effect(() => {
    if (!box) return;
    const observer = new ResizeObserver(() => void update());
    observer.observe(box);
    void document.fonts?.ready.then(() => update());
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  });
</script>

<div bind:this={box} class="overflow-hidden" {style}>
  <div bind:this={track} class="inline-flex whitespace-nowrap">
    <span bind:this={first}>{text}</span>
    {#if overflowing}
      <span aria-hidden="true" style="padding-left: {GAP_EM}em;">{text}</span>
    {/if}
  </div>
</div>
