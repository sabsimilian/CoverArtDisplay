<script lang="ts">
  import { settingsModal, closeSettingsModal, type SettingsTab } from "$lib/state/settings-modal.svelte";
  import { settings, type AppSettings } from "$lib/state/settings.svelte";
  import { appApi } from "$lib/tauri/api";
  import DisplayModesTab from "./DisplayModesTab.svelte";
  import VideoManagerTab from "./VideoManagerTab.svelte";
  import PhotoManagerTab from "./PhotoManagerTab.svelte";
  import AppSettingsTab from "./AppSettingsTab.svelte";

  interface Props {
    // The dedicated settings-only popup window renders this always-open,
    // full-bleed, with no backdrop and no title-bar close (X) button — but it
    // still needs its own Cancel/Save footer, since that's the only way to
    // close *that* window (it has no gear menu of its own either).
    inline?: boolean;
  }
  let { inline = false }: Props = $props();

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "display-modes", label: "Idle Modes" },
    { id: "video-manager", label: "Video Manager" },
    { id: "photo-manager", label: "Photo Manager" },
    { id: "app-settings", label: "App Settings" },
  ];

  // Snapshot taken when the modal opens so Cancel can restore it. Most
  // controls still write straight to the live settings store as you change
  // them (matching V1), so Cancel mainly matters for cosmetic parity.
  let snapshot: AppSettings | null = null;
  $effect(() => {
    if (settingsModal.isOpen && snapshot === null) snapshot = settings.value;
    if (!settingsModal.isOpen) snapshot = null;
  });

  function handleCancel(): void {
    if (snapshot) settings.value = snapshot;
    if (inline) appApi.closeSettingsWindow();
    else closeSettingsModal();
  }

  function handleSave(): void {
    if (inline) appApi.closeSettingsWindow();
    else closeSettingsModal();
  }
</script>

{#if inline || settingsModal.isOpen}
  <div
    class={inline
      ? "h-screen w-full overflow-hidden bg-[#121212]"
      : "fixed inset-0 z-[10200] flex items-start justify-center overflow-auto bg-black/80 pt-[3%]"}
  >
    <div
      class={inline
        ? "flex h-full w-full flex-col"
        : "flex max-h-[92vh] w-[min(92%,800px)] flex-col overflow-hidden rounded-2xl border border-white/7 bg-[#191919] shadow-2xl"}
    >
      <div class="flex flex-shrink-0 items-center justify-between border-b border-white/6 px-6 py-5">
        <h2 class="text-xl font-semibold text-white">Settings</h2>
        {#if !inline}
          <button
            class="cursor-pointer text-2xl font-bold text-white/60 transition hover:text-[var(--accent-color)]"
            onclick={handleCancel}
          >
            &times;
          </button>
        {/if}
      </div>

      <div class="flex flex-shrink-0 overflow-x-auto border-b border-white/6 px-4">
        {#each tabs as tab (tab.id)}
          <button
            class="flex-shrink-0 cursor-pointer border-b-2 px-3 py-2.5 font-medium whitespace-nowrap transition-colors"
            style={settingsModal.activeTab === tab.id
              ? "color: var(--accent-color); border-color: var(--accent-color);"
              : "color: #aaa; border-color: transparent;"}
            onclick={() => (settingsModal.activeTab = tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="themed-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {#if settingsModal.activeTab === "display-modes"}
          <DisplayModesTab />
        {:else if settingsModal.activeTab === "video-manager"}
          <VideoManagerTab />
        {:else if settingsModal.activeTab === "photo-manager"}
          <PhotoManagerTab />
        {:else if settingsModal.activeTab === "app-settings"}
          <AppSettingsTab />
        {/if}
      </div>

      <div class="flex flex-shrink-0 justify-end gap-2.5 border-t border-white/6 px-5 py-3.5">
        <button
          class="cursor-pointer rounded-full border border-white/40 px-5 py-2 text-sm text-white transition hover:bg-white/10"
          onclick={handleCancel}
        >
          Cancel
        </button>
        <button
          class="cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          style="background-color: var(--accent-color);"
          onclick={handleSave}
        >
          Save Settings
        </button>
      </div>
    </div>
  </div>
{/if}
