<script lang="ts">
  import { settings } from "$lib/state/settings.svelte";

  let now = $state(new Date());

  $effect(() => {
    const id = setInterval(() => {
      now = new Date();
    }, 1000);
    return () => clearInterval(id);
  });

  const time = $derived(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const dateLabel = $derived(now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
</script>

<!--
  Mounted only by StandbyView.svelte, which itself only mounts while idle
  (nothing playing) and outside widget mode — that's what keeps the clock
  hidden during loading/login/settingsOnly/playing/widget mode, rather than
  an extra visibility flag on this component (V1 achieved the same end
  result by explicitly calling hideAmbientClock() from its view-switch
  functions; here it's just never in the tree to begin with).
-->
{#if settings.value.ambientClockEnabled}
  <div class="pointer-events-none fixed top-10 right-10 z-10 rounded-[10px] bg-black/40 px-6 py-4 text-right shadow-md backdrop-blur-sm">
    <div class="text-6xl leading-tight font-light text-white" style="text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
      {time}
    </div>
    <div class="text-2xl font-light text-white/70">{dateLabel}</div>
  </div>
{/if}
