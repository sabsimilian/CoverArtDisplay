<script lang="ts">
  import { onMount } from "svelte";
  import { settings, setBackgroundStyle, backgroundStyle, getAutoStart, setAutoStart } from "$lib/state/settings.svelte";
  import type { BackgroundStyle } from "$lib/state/settings.svelte";
  import { appApi } from "$lib/tauri/api";
  import { alertDialog, confirmDialog } from "$lib/state/dialog.svelte";
  import ToggleSwitch from "$lib/components/ToggleSwitch.svelte";

  const DONATE_URL =
    "https://www.paypal.com/donate/?business=U27PB86V87C8Q&no_recurring=1&item_name=If+you+like+the+app%2C+consider+buying+me+a+beer+%28%3D&currency_code=EUR";

  const fontOptions = [
    { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
    { value: "Arial, sans-serif", label: "Arial" },
    { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
    {
      value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      label: "System Default",
    },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "'Segoe UI', Tahoma, Geneva, sans-serif", label: "Segoe UI" },
    { value: "'Trebuchet MS', Helvetica, sans-serif", label: "Trebuchet MS" },
    { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
    { value: "'Courier New', Courier, monospace", label: "Courier New" },
    { value: "Roboto, Arial, sans-serif", label: "Roboto" },
  ];

  const bgStyles: { id: BackgroundStyle; label: string }[] = [
    { id: "static", label: "Static" },
    { id: "gradient", label: "Gradient" },
    { id: "coverimage", label: "Cover Image" },
  ];

  let autoStartEnabled = $state(false);
  let appVersion = $state("");
  let updateButtonLabel = $state("Check for Updates");
  let updateButtonBusy = $state(false);

  onMount(async () => {
    autoStartEnabled = await getAutoStart();
    try {
      appVersion = await appApi.getAppVersion();
    } catch {
      appVersion = "";
    }
  });

  function update(patch: Partial<typeof settings.value>): void {
    settings.value = { ...settings.value, ...patch };
  }

  async function handleAutoStartToggle(enabled: boolean): Promise<void> {
    autoStartEnabled = await setAutoStart(enabled);
  }

  async function handleCheckForUpdates(): Promise<void> {
    updateButtonBusy = true;
    updateButtonLabel = "Checking...";
    try {
      const result = await appApi.checkForUpdates();
      if (result.error) {
        await alertDialog(`Couldn't check for updates: ${result.error}`);
        return;
      }
      if (!result.updateAvailable) {
        await alertDialog(`You're up to date (v${result.currentVersion}).`);
        return;
      }
      if (result.assetUrl) {
        const proceed = await confirmDialog(
          `A new version is available: v${result.latestVersion} (you have v${result.currentVersion}).\n\nDownload and install it now? The app will close and the installer will open.`,
        );
        if (proceed) {
          updateButtonLabel = "Downloading...";
          try {
            await appApi.downloadAndInstallUpdate(result.assetUrl, result.assetName ?? "update");
          } catch {
            await alertDialog("Couldn't download the update. Check your internet connection and try again.");
          }
        }
      } else if (result.releaseUrl) {
        const proceed = await confirmDialog(
          `A new version is available: v${result.latestVersion} (you have v${result.currentVersion}).\n\nOpen the release page?`,
        );
        if (proceed) await appApi.openExternal(result.releaseUrl);
      }
    } catch {
      await alertDialog("Couldn't check for updates. Check your internet connection and try again.");
    } finally {
      if (updateButtonLabel === "Checking...") {
        updateButtonLabel = "Check for Updates";
        updateButtonBusy = false;
      }
    }
  }

  async function handleDonate(): Promise<void> {
    await appApi.openExternal(DONATE_URL);
  }
</script>

<div class="mb-5 rounded-lg border border-[#333] bg-[#1a1a1a] p-4">
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="font-medium text-white">Accent Color</span>
    <input
      type="color"
      value={settings.value.accentColor}
      oninput={(e) => update({ accentColor: (e.target as HTMLInputElement).value })}
    />
  </div>

  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="font-medium text-white">Style</span>
    <div class="flex items-center gap-2">
      <span class="text-sm text-white/60">Default / Fit</span>
      <ToggleSwitch
        checked={settings.value.blurStyleEnabled}
        onchange={(checked) => update({ blurStyleEnabled: checked })}
      />
    </div>
  </div>

  <div class="mb-3">
    <div class="mb-2 font-medium text-white">Background Style</div>
    <div class="flex gap-1 rounded-lg border border-[#333] bg-[#1a1a1a] p-0.75">
      {#each bgStyles as bs (bs.id)}
        <button
          type="button"
          class="flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors"
          style={backgroundStyle(settings.value) === bs.id
            ? "background-color: var(--accent-color); color: white;"
            : "color: rgba(255,255,255,0.65);"}
          onclick={() => setBackgroundStyle(bs.id)}
        >
          {bs.label}
        </button>
      {/each}
    </div>
  </div>

  {#if backgroundStyle(settings.value) === "static"}
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="font-medium text-white">Color</span>
      <input
        type="color"
        value={settings.value.areaUnderCoverBgColor}
        oninput={(e) => {
          update({ areaUnderCoverBgColor: (e.target as HTMLInputElement).value });
          setBackgroundStyle("static");
        }}
      />
    </div>
  {/if}

  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="font-medium text-white">Transparent</span>
    <div class="flex items-center gap-2">
      <span class="text-sm text-white/60">Off / On</span>
      <ToggleSwitch
        checked={settings.value.areaTransparentMode}
        onchange={(checked) => update({ areaTransparentMode: checked })}
      />
    </div>
  </div>

  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="font-medium text-white">Text Color</span>
    <div class="flex items-center gap-2">
      <span class="text-sm text-white/60">Black / White</span>
      <ToggleSwitch
        checked={settings.value.textWhiteMode}
        onchange={(checked) => update({ textWhiteMode: checked })}
      />
    </div>
  </div>

  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="font-medium text-white">Text Opacity</span>
    <div class="flex w-[clamp(100px,40%,220px)] flex-shrink-0 items-center whitespace-nowrap">
      <input
        type="range"
        min="50"
        max="100"
        step="5"
        value={settings.value.textOpacity}
        oninput={(e) => update({ textOpacity: parseInt((e.target as HTMLInputElement).value, 10) })}
        class="themed-range mr-2.5 flex-1 cursor-pointer"
      />
      <span class="min-w-[45px] text-right" style="color: var(--accent-color);">{settings.value.textOpacity}%</span>
    </div>
  </div>

  <div class="flex items-center justify-between gap-2">
    <span class="font-medium text-white">Font:</span>
    <select
      value={settings.value.appFontFamily}
      onchange={(e) => update({ appFontFamily: (e.target as HTMLSelectElement).value })}
      class="w-[190px] cursor-pointer rounded border border-[#444] bg-[#282828] px-3 py-2 text-sm text-white"
    >
      {#each fontOptions as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>
</div>

<div class="my-5 h-px bg-[#333]"></div>

<div>
  <h3 class="mb-4 text-lg font-medium text-white">Application Settings</h3>

  <div class="mb-4 flex items-center justify-between py-1">
    <label for="startup-mode" class="font-medium text-white">Launch on System Startup</label>
    <ToggleSwitch id="startup-mode" checked={autoStartEnabled} onchange={handleAutoStartToggle} />
  </div>

  <div class="mb-4 flex items-center justify-between py-1">
    <label for="start-fullscreen" class="font-medium text-white">Start in Fullscreen</label>
    <ToggleSwitch
      id="start-fullscreen"
      checked={settings.value.startInFullscreen}
      onchange={(checked) => update({ startInFullscreen: checked })}
    />
  </div>

  <div class="mb-4 flex items-center justify-between py-1">
    <label for="start-widget-mode" class="font-medium text-white">Start in Widget Mode</label>
    <ToggleSwitch
      id="start-widget-mode"
      checked={settings.value.startInWidgetMode}
      onchange={(checked) => update({ startInWidgetMode: checked })}
    />
  </div>

  <div class="mb-4 flex items-center justify-between py-1">
    <label for="ambient-clock-toggle" class="font-medium text-white">
      Show Clock (Video Art / Library Covers / Picture Frame)
    </label>
    <ToggleSwitch
      id="ambient-clock-toggle"
      checked={settings.value.ambientClockEnabled}
      onchange={(checked) => update({ ambientClockEnabled: checked })}
    />
  </div>

  <div class="mb-4 flex items-center justify-between py-1">
    <label for="controls-toggle" class="font-medium text-white">
      Playback Controls on Hover
    </label>
    <ToggleSwitch
      id="controls-toggle"
      checked={settings.value.controlsEnabled}
      onchange={(checked) => update({ controlsEnabled: checked })}
    />
  </div>

  <div class="mb-4 flex items-center justify-between py-1">
    <label for="progress-bar-toggle" class="font-medium text-white"> Now Playing Progress Bar </label>
    <ToggleSwitch
      id="progress-bar-toggle"
      checked={settings.value.progressBarEnabled}
      onchange={(checked) => update({ progressBarEnabled: checked })}
    />
  </div>

  <div class="mt-2.5 flex items-center justify-between border-t border-[#333] pt-2.5">
    <div class="text-white/60">Version: {appVersion}</div>
    <button
      class="cursor-pointer rounded-full border border-white/40 px-4 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
      disabled={updateButtonBusy}
      onclick={handleCheckForUpdates}
    >
      {updateButtonLabel}
    </button>
  </div>

  <div class="mt-4 flex items-center justify-between">
    <span class="text-white">If you like the app, consider buying me a beer</span>
    <button
      class="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
      style="background-color: var(--accent-color);"
      onclick={handleDonate}
    >
      Donate
    </button>
  </div>
</div>
