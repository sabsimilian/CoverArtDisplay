<script lang="ts">
  import { settings } from "$lib/state/settings.svelte";
  import { appApi } from "$lib/tauri/api";
  import { alertDialog, confirmDialog } from "$lib/state/dialog.svelte";
  import ToggleSwitch from "$lib/components/ToggleSwitch.svelte";

  let scanningFolders = $state<Record<string, boolean>>({});

  async function handleAddFolder(): Promise<void> {
    const folder = await appApi.selectVideoFolder(); // same native folder picker as videos
    if (!folder) return;
    if (!settings.addPhotoFolderEntry(folder)) {
      await alertDialog("This folder is already added.");
      return;
    }
    scanningFolders = { ...scanningFolders, [folder]: true };
    try {
      const result = await appApi.getFolderPhotos(folder);
      settings.setFolderPhotos(folder, result.photos);
      if (result.error) await alertDialog(result.error);
    } catch {
      settings.deletePhotoFolder(folder);
      await alertDialog("Failed to add folder.");
    } finally {
      const next = { ...scanningFolders };
      delete next[folder];
      scanningFolders = next;
    }
  }

  async function handleDeleteFolder(folder: string): Promise<void> {
    if (await confirmDialog(`Remove folder "${folder}" from photo sources?`)) settings.deletePhotoFolder(folder);
  }

  async function handleRefreshFolder(folder: string): Promise<void> {
    scanningFolders = { ...scanningFolders, [folder]: true };
    try {
      const result = await appApi.getFolderPhotos(folder);
      if (result.error) {
        await alertDialog(result.error);
      } else {
        settings.setFolderPhotos(folder, result.photos);
        await alertDialog(`Folder refreshed: ${result.photos.length} photos found.`);
      }
    } finally {
      const next = { ...scanningFolders };
      delete next[folder];
      scanningFolders = next;
    }
  }

  async function handleReset(): Promise<void> {
    if (await confirmDialog("Reset all photos? This removes every photo folder.")) settings.resetPhotoSources();
  }

  function handleBwToggle(checked: boolean): void {
    settings.value = { ...settings.value, pictureFrameBW: checked };
  }
</script>

<div>
  <h4 class="mb-2.5 text-sm font-normal" style="color: var(--accent-color);">Photo Folders</h4>
  <div class="themed-scrollbar mb-4 max-h-[300px] overflow-y-auto rounded-md border border-[#333] bg-[#1a1a1a]">
    {#if settings.value.photoFolders.length === 0}
      <div class="p-4 text-center text-white/50 italic">No photo folders added</div>
    {:else}
      {#each settings.value.photoFolders as folder (folder)}
        <div class="flex items-start gap-2 border-b border-[#333] p-3 last:border-b-0">
          <div class="min-w-0 flex-1">
            <div class="line-clamp-2 break-all font-medium text-white">{folder}</div>
            {#if scanningFolders[folder]}
              <div class="text-xs" style="color: var(--accent-color);">Scanning folder...</div>
            {:else}
              <div class="text-xs text-white/50">
                {(settings.value.photoFiles[folder] ?? []).length} photos
              </div>
            {/if}
          </div>
          <button
            class="ml-1 flex-shrink-0 cursor-pointer rounded px-2 py-1 text-white/50 transition hover:text-[var(--accent-color)]"
            onclick={() => handleRefreshFolder(folder)}
          >
            ↻
          </button>
          <button
            class="ml-1 flex-shrink-0 cursor-pointer rounded px-2 py-1 text-white/50 transition hover:bg-red-500/10 hover:text-red-500"
            onclick={() => handleDeleteFolder(folder)}
          >
            ✕
          </button>
        </div>
      {/each}
    {/if}
  </div>

  <div class="mb-5 rounded-lg border border-[#333] p-3">
    <div class="flex items-center justify-between">
      <label for="pictureframe-bw-toggle" class="font-medium text-white">Black &amp; White</label>
      <ToggleSwitch id="pictureframe-bw-toggle" checked={settings.value.pictureFrameBW} onchange={handleBwToggle} />
    </div>
  </div>

  <div class="mb-5">
    <button
      class="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
      style="background-color: var(--accent-color);"
      onclick={handleAddFolder}
    >
      Add Photo Folder
    </button>
  </div>

  <button
    class="cursor-pointer rounded-full px-4 py-2 text-sm text-white transition hover:brightness-110"
    style="background-color: var(--accent-color);"
    onclick={handleReset}
  >
    Reset Photos
  </button>
</div>
