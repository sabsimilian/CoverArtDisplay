<script lang="ts">
  import { settings } from "$lib/state/settings.svelte";
  import { appApi } from "$lib/tauri/api";
  import { alertDialog, confirmDialog } from "$lib/state/dialog.svelte";
  import { pathBasename, truncateEnd } from "$lib/utils/format";

  let showUrlForm = $state(false);
  let urlInput = $state("");
  let scanningFolders = $state<Record<string, boolean>>({});

  async function handleAddFile(): Promise<void> {
    const path = await appApi.selectVideoFile();
    if (path) settings.addVideoSource(path);
  }

  function handleShowUrlForm(): void {
    showUrlForm = true;
  }

  function handleSubmitUrl(): void {
    if (urlInput.trim()) settings.addVideoSource(urlInput);
    urlInput = "";
    showUrlForm = false;
  }

  async function handleAddFolder(): Promise<void> {
    const folder = await appApi.selectVideoFolder();
    if (!folder) return;
    if (!settings.addVideoFolderEntry(folder)) {
      await alertDialog("This folder is already added.");
      return;
    }
    scanningFolders = { ...scanningFolders, [folder]: true };
    try {
      const result = await appApi.getFolderVideos(folder);
      settings.setFolderVideos(folder, result.videos);
      if (result.error) await alertDialog(result.error);
    } catch {
      settings.deleteVideoFolder(folder);
      await alertDialog("Failed to add folder.");
    } finally {
      const next = { ...scanningFolders };
      delete next[folder];
      scanningFolders = next;
    }
  }

  async function handleDeleteVideo(index: number): Promise<void> {
    if (await confirmDialog("Delete this video?")) settings.deleteVideoSource(index);
  }

  async function handleDeleteFolder(folder: string): Promise<void> {
    if (await confirmDialog(`Remove folder "${folder}" from video sources?`)) settings.deleteVideoFolder(folder);
  }

  async function handleRefreshFolder(folder: string): Promise<void> {
    scanningFolders = { ...scanningFolders, [folder]: true };
    try {
      const result = await appApi.getFolderVideos(folder);
      if (result.error) {
        // Mirrors V1: don't overwrite a previously-known list just because a
        // network share/removable drive was briefly unavailable.
        await alertDialog(result.error);
      } else {
        settings.setFolderVideos(folder, result.videos);
      }
    } finally {
      const next = { ...scanningFolders };
      delete next[folder];
      scanningFolders = next;
    }
  }

  async function handleReset(): Promise<void> {
    if (await confirmDialog("Reset all videos? This removes every individual video and folder.")) {
      settings.resetVideoSources();
    }
  }
</script>

<div class="mb-6">
  <h4 class="mb-2.5 text-sm font-normal" style="color: var(--accent-color);">Individual Videos</h4>
  <div class="themed-scrollbar mb-4 max-h-[300px] overflow-y-auto rounded-md border border-[#333] bg-[#1a1a1a]">
    {#if settings.value.videoSources.length === 0}
      <div class="p-4 text-center text-white/50 italic">No individual videos added</div>
    {:else}
      {#each settings.value.videoSources as source, index (index)}
        <div class="flex items-start gap-2 border-b border-[#333] p-3 last:border-b-0">
          <div class="min-w-0 flex-1">
            <div class="text-white">{pathBasename(source)}</div>
            <div class="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-white/50">
              {truncateEnd(source)}
            </div>
          </div>
          <button
            class="ml-2 flex-shrink-0 cursor-pointer rounded px-2 py-1 text-white/50 transition hover:bg-red-500/10 hover:text-red-500"
            onclick={() => handleDeleteVideo(index)}
          >
            ✕
          </button>
        </div>
      {/each}
    {/if}
  </div>

  <h4 class="mb-2.5 text-sm font-normal" style="color: var(--accent-color);">Video Folders</h4>
  <div class="themed-scrollbar mb-4 max-h-[300px] overflow-y-auto rounded-md border border-[#333] bg-[#1a1a1a]">
    {#if settings.value.videoFolders.length === 0}
      <div class="p-4 text-center text-white/50 italic">No video folders added</div>
    {:else}
      {#each settings.value.videoFolders as folder (folder)}
        <div class="flex items-start gap-2 border-b border-[#333] p-3 last:border-b-0">
          <div class="min-w-0 flex-1">
            <div class="line-clamp-2 break-all font-medium text-white">{folder}</div>
            {#if scanningFolders[folder]}
              <div class="text-xs" style="color: var(--accent-color);">Scanning folder...</div>
            {:else}
              <div class="text-xs text-white/50">
                {(settings.value.folderVideos[folder] ?? []).length} videos
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

  <div class="mb-6">
    <div class="mb-4 flex gap-2.5">
      <button
        class="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        style="background-color: var(--accent-color);"
        onclick={handleAddFile}
      >
        Add Video File
      </button>
      <button
        class="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        style="background-color: var(--accent-color);"
        onclick={handleAddFolder}
      >
        Add Video Folder
      </button>
      <button
        class="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        style="background-color: var(--accent-color);"
        onclick={handleShowUrlForm}
      >
        Add URL
      </button>
    </div>
    {#if showUrlForm}
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={urlInput}
          placeholder="Enter video URL"
          class="flex-1 rounded border border-[#444] bg-[#282828] px-4 py-2.5 text-white outline-none focus:border-[var(--accent-color)]"
        />
        <button
          class="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
          style="background-color: var(--accent-color);"
          onclick={handleSubmitUrl}
        >
          Add
        </button>
      </div>
    {/if}
  </div>

  <button
    class="cursor-pointer rounded-full px-4 py-2 text-sm text-white transition hover:brightness-110"
    style="background-color: var(--accent-color);"
    onclick={handleReset}
  >
    Reset Videos
  </button>
</div>
