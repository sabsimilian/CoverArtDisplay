<script lang="ts">
  import { appApi } from "$lib/tauri/api";
  import { logout } from "$lib/state/auth.svelte";
  import { widget, toggleWidgetMode, disableWidgetMode } from "$lib/state/widget.svelte";
  import { openSettingsModal } from "$lib/state/settings-modal.svelte";

  let open = $state(false);
  let containerEl: HTMLDivElement | undefined = $state();

  function toggleMenu(): void {
    open = !open;
  }

  function handleWindowClick(e: MouseEvent): void {
    if (open && containerEl && !containerEl.contains(e.target as Node)) {
      open = false;
    }
  }

  async function handleFullscreen(): Promise<void> {
    open = false;
    if (widget.enabled) await disableWidgetMode();
    else await appApi.toggleFullscreen();
  }

  async function handleMinimize(): Promise<void> {
    open = false;
    await appApi.minimizeWindow();
  }

  async function handleWidgetToggle(): Promise<void> {
    open = false;
    await toggleWidgetMode();
  }

  async function handleSettings(): Promise<void> {
    open = false;
    await openSettingsModal();
  }

  async function handleLogout(): Promise<void> {
    open = false;
    await logout();
  }

  async function handleExit(): Promise<void> {
    await appApi.closeApp();
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="menu-hover-area" bind:this={containerEl}>
  <div class="fixed top-6 right-6 z-[999]">
    <button
      type="button"
      class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 shadow-lg backdrop-blur-md transition-colors duration-200 hover:[background-color:color-mix(in_srgb,var(--accent-color)_70%,transparent)]"
      onclick={toggleMenu}
    >
      <span class="text-2xl text-white/90">⚙</span>
    </button>

    {#if open}
      <div
        class="absolute top-[58px] right-0 w-[215px] overflow-hidden rounded-xl border border-white/8 bg-[rgba(20,20,26,0.96)] shadow-2xl backdrop-blur-xl"
      >
        <button
          class="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/7"
          onclick={handleFullscreen}
        >
          <span class="mr-3 inline-block w-5 text-center opacity-80">⤢</span>Fullscreen
        </button>
        <button
          class="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/7"
          onclick={handleMinimize}
        >
          <span class="mr-3 inline-block w-5 text-center opacity-80">─</span>Minimize
        </button>
        <button
          class="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/7"
          style={widget.enabled ? "background-color: color-mix(in srgb, var(--accent-color) 15%, transparent); color: var(--accent-color);" : "color: white;"}
          onclick={handleWidgetToggle}
        >
          <span class="mr-3 inline-block w-5 text-center opacity-80">⊡</span>Widget Mode
        </button>
        <button
          class="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/7"
          onclick={handleSettings}
        >
          <span class="mr-3 inline-block w-5 text-center opacity-80">⚙</span>Settings
        </button>
        <button
          class="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/7"
          onclick={handleLogout}
        >
          <span class="mr-3 inline-block w-5 text-center opacity-80">↪</span>Logout
        </button>
        <button
          class="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/7"
          onclick={handleExit}
        >
          <span class="mr-3 inline-block w-5 text-center opacity-80">×</span>Exit
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .menu-hover-area {
    position: absolute;
    top: 0;
    right: 0;
    width: 96px;
    height: 96px;
    z-index: 10001;
  }
  .menu-hover-area:hover :global(.opacity-0) {
    opacity: 1;
  }
  /* Suppress WebView2/Chromium's default blue focus ring on these buttons —
     matches V1, which had no such outline either. */
  .menu-hover-area :global(button) {
    outline: none;
  }
</style>
