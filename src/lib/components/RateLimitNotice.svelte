<script lang="ts">
  import { playback } from "$lib/state/playback.svelte";

  let now = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => {
      now = Date.now();
    }, 15000);
    return () => clearInterval(id);
  });

  const until = $derived(playback.rateLimitedUntil);
  const resumesAt = $derived(
    new Date(until).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  );
</script>

<!--
  Spotify's development-mode lockouts last hours, during which the screen
  can't follow playback. Without this, a frozen cover looks like the app has
  hung; this says why, and when it will pick up again.
-->
{#if until > now}
  <div
    class="pointer-events-none fixed bottom-4 left-1/2 z-[10200] -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm whitespace-nowrap text-white/80 shadow-md backdrop-blur-sm"
    style="font-family: var(--app-font-family);"
  >
    Spotify request limit reached · resumes at {resumesAt}
  </div>
{/if}
