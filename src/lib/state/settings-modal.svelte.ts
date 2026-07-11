// UI state for the settings modal. When the window is too small (or widget
// mode is active) to host the inline modal, it routes to the separate native
// settings popup window instead (open_settings_window in the Rust backend) —
// mirrors V1's openSettingsModal() size check exactly.

import { appApi } from "../tauri/api";
import { widget } from "./widget.svelte";

export type SettingsTab = "display-modes" | "video-manager" | "photo-manager" | "app-settings";

let isOpen = $state(false);
let activeTab = $state<SettingsTab>("display-modes");

export const settingsModal = {
  get isOpen() {
    return isOpen;
  },
  get activeTab() {
    return activeTab;
  },
  set activeTab(tab: SettingsTab) {
    activeTab = tab;
  },
};

export async function openSettingsModal(): Promise<void> {
  const windowTooSmall = window.innerWidth < 600 || window.innerHeight < 520;
  if (widget.enabled || windowTooSmall) {
    await appApi.openSettingsWindow();
    return;
  }
  isOpen = true;
}

export function closeSettingsModal(): void {
  isOpen = false;
}
