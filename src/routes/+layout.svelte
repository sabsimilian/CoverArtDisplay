<script lang="ts">
  import "../app.css";
  import { settings } from "$lib/state/settings.svelte";
  import { widget, disableWidgetMode } from "$lib/state/widget.svelte";
  import DialogHost from "$lib/components/DialogHost.svelte";
  import TitleBarRegion from "$lib/components/TitleBarRegion.svelte";
  import AppMenu from "$lib/components/AppMenu.svelte";
  import { isSettingsOnly } from "$lib/utils/settings-only";

  let { children } = $props();

  // The settings popup window (opened via open_settings_window in the Rust
  // backend) loads this exact same page/layout with ?settingsOnly=1 — it has
  // no window dragging or gear menu of its own, just the settings UI itself.
  const settingsOnly = isSettingsOnly();

  // Runtime-themable CSS custom properties (see app.css) — replaces V1's
  // applyAccentColor/applyFontFamily/applyTextColor/applyTransparentMode,
  // which each imperatively pushed one var onto documentElement.style. Runs
  // in both windows so the settings popup's own preview (e.g. font family
  // select, accent-colored buttons) stays live too.
  $effect(() => {
    const s = settings.value;
    const root = document.documentElement.style;
    root.setProperty("--accent-color", s.accentColor);
    root.setProperty("--app-font-family", s.appFontFamily);
    root.setProperty("--text-color", s.textWhiteMode ? "#FFFFFF" : "#000000");
    root.setProperty("--text-opacity", String(s.textOpacity / 100));
    root.setProperty("--area-bg-opacity", s.areaTransparentMode ? "0.5" : "1");
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && widget.enabled) {
      disableWidgetMode();
    }
  }

  // Defensive fallback matching the OG app: the settings popup window is NOT
  // created with transparent:true (see open_settings_window in the Rust
  // backend), so body's global `background: transparent` would otherwise
  // fall through to WebView2's default canvas wherever nothing else paints.
  // SettingsModal's own inline wrapper should already cover the full
  // viewport, but this is a cheap belt-and-suspenders in case it doesn't.
  $effect(() => {
    document.body.classList.toggle("settings-only", settingsOnly);
    document.body.classList.toggle("widget-mode", widget.enabled);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !settingsOnly}
  <TitleBarRegion />
  <AppMenu />
{/if}

{@render children()}

<DialogHost />
