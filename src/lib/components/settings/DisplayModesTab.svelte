<script lang="ts">
  import { settings, type StandbyMode } from "$lib/state/settings.svelte";
  import { formatDuration } from "$lib/utils/format";

  const modes: { id: StandbyMode; label: string; description: string }[] = [
    { id: "videoart", label: "Video Art", description: "Display ambient video backgrounds" },
    {
      id: "librarycovers",
      label: "Library Covers",
      description: "Display slideshow of album covers from your Liked Songs list",
    },
    { id: "pictureframe", label: "Picture Frame", description: "Display a slideshow of your personal photos" },
  ];

  function selectMode(mode: StandbyMode): void {
    settings.value = { ...settings.value, standbyModePreference: mode };
  }

  const fraction = $derived((settings.value.mediaChangeInterval - 30) / (1800 - 30));

  function handleSlider(e: Event): void {
    const seconds = parseInt((e.target as HTMLInputElement).value, 10);
    settings.value = { ...settings.value, mediaChangeInterval: seconds };
  }
</script>

<div class="mb-7">
  <h3 class="mb-4 text-lg font-medium text-white">Idle Modes</h3>
  <div class="flex flex-wrap gap-3.5">
    {#each modes as mode (mode.id)}
      <button
        type="button"
        class="flex h-[104px] w-[calc(50%-7px)] min-w-[220px] cursor-pointer flex-col justify-center rounded-xl border p-4 text-left transition-colors"
        style={settings.value.standbyModePreference === mode.id
          ? "border-color: var(--accent-color); background-color: color-mix(in srgb, var(--accent-color) 10%, transparent);"
          : "border-color: #333; background-color: #1e1e1e;"}
        onclick={() => selectMode(mode.id)}
      >
        <div class="mb-1 font-semibold text-white">{mode.label}</div>
        <div class="text-sm text-white/60">{mode.description}</div>
      </button>
    {/each}
  </div>
</div>

<div>
  <h3 class="mb-4 text-lg font-medium text-white">Change Interval</h3>
  <div class="py-1.5">
    <!-- Full-width pill with the value overlaid on top (pointer-events-none,
         so it never blocks dragging the input beneath it) instead of a
         separate fixed-width label next to the slider — that label's width
         couldn't accommodate every digit-count/wrap combination ("5m" vs
         "27m 30s"), so it visibly wrapped to two lines and shifted position
         depending on the current value. -->
    <div
      class="relative h-11 w-full rounded-[22px]"
      style="background: linear-gradient(to right, var(--accent-color) calc(16px + (100% - 32px) * {fraction}), rgba(255,255,255,0.1) 0);"
    >
      <input
        type="range"
        min="30"
        max="1800"
        step="30"
        value={settings.value.mediaChangeInterval}
        oninput={handleSlider}
        class="pill-slider-input"
      />
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-end pr-5 text-sm font-semibold tabular-nums whitespace-nowrap text-white"
      >
        {formatDuration(settings.value.mediaChangeInterval)}
      </div>
    </div>
  </div>
</div>

<style>
  .pill-slider-input {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    width: calc(100% - 32px);
    margin: 0 16px;
    height: 44px;
    background: transparent;
    outline: none;
    cursor: pointer;
  }
  .pill-slider-input::-webkit-slider-runnable-track {
    background: transparent;
  }
  .pill-slider-input::-moz-range-track {
    height: 44px;
    border-radius: 22px;
    background: transparent;
  }
  .pill-slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 6px;
    height: 30px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }
  .pill-slider-input::-moz-range-thumb {
    width: 6px;
    height: 30px;
    border: none;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }
</style>
