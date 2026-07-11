<script lang="ts">
  import { onMount } from "svelte";
  import { auth, initAuth } from "$lib/state/auth.svelte";
  import { playback, startPolling, stopPolling } from "$lib/state/playback.svelte";
  import { widget, enableWidgetMode } from "$lib/state/widget.svelte";
  import { settings } from "$lib/state/settings.svelte";
  import { appApi } from "$lib/tauri/api";
  import LoadingView from "$lib/components/views/LoadingView.svelte";
  import LoginView from "$lib/components/views/LoginView.svelte";
  import PlayerView from "$lib/components/views/PlayerView.svelte";
  import StandbyView from "$lib/components/views/StandbyView.svelte";
  import WidgetView from "$lib/components/views/WidgetView.svelte";
  import SettingsModal from "$lib/components/settings/SettingsModal.svelte";
  import { isSettingsOnly } from "$lib/utils/settings-only";

  // The settings popup window (opened via open_settings_window in the Rust
  // backend) loads this exact same page with ?settingsOnly=1 — same pattern
  // V1 used, and the most robust one under SvelteKit's static-adapter SPA
  // mode (a query string needs no separate prerendered route to exist).
  const settingsOnly = isSettingsOnly();

  onMount(() => {
    if (settingsOnly) return;
    initAuth();
    startPolling();
    if (settings.value.startInFullscreen) {
      setTimeout(() => appApi.toggleFullscreen(), 300);
    }
    if (settings.value.startInWidgetMode) {
      enableWidgetMode();
    }
    return () => stopPolling();
  });
</script>

<main class="h-screen w-screen">
  {#if settingsOnly}
    <SettingsModal inline />
  {:else if auth.state === "loading"}
    <LoadingView />
  {:else if auth.state === "login"}
    <LoginView />
  {:else if widget.enabled}
    <WidgetView />
  {:else if playback.isPlaying}
    <PlayerView />
  {:else}
    <StandbyView />
  {/if}
</main>

{#if !settingsOnly}
  <SettingsModal />
{/if}
