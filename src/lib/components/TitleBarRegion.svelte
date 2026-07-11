<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";

  // Deliberately NOT using the plain `data-tauri-drag-region` attribute —
  // Tauri's own injected script already wires a mousedown listener for that
  // attribute, and having BOTH that listener and this one call
  // startDragging() for the same click is a plausible source of the drag
  // silently failing (two competing OS-level "start moving this window"
  // requests for one mouse gesture). This handler is the only trigger.
  function handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    getCurrentWindow()
      .startDragging()
      .catch((err) => console.error("startDragging failed:", err));
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="title-bar-region" onmousedown={handleMouseDown}></div>

<style>
  .title-bar-region {
    -webkit-user-select: none;
    user-select: none;
  }
</style>
