// Hides the mouse cursor until the mouse actually moves, and again after a
// few seconds of stillness — like a video player. On a dedicated display
// (e.g. a Pi running only this app) there's often no mouse at all, yet the
// compositor still draws a cursor that pops up over the cover art whenever
// the element under it changes; this keeps it out of the way everywhere.
//
// With alwaysHideCursor on, motion never brings it back. That's for kiosks
// with no mouse at all: the compositor's pointer still gets nudged onto the
// page (so WebKit can hide it), and that nudge must not count as a mouse
// moving — WebKit only re-reads the cursor style on motion, so a cursor
// shown by the nudge would stay on screen after the class came back.

import { settings } from "../state/settings.svelte";

const HIDE_AFTER_MS = 3000;

export function startCursorAutoHide(): () => void {
  const root = document.documentElement;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const hide = () => root.classList.add("cursor-hidden");
  const onMove = () => {
    if (settings.value.alwaysHideCursor) return hide();
    root.classList.remove("cursor-hidden");
    if (timer) clearTimeout(timer);
    timer = setTimeout(hide, HIDE_AFTER_MS);
  };

  hide();
  window.addEventListener("mousemove", onMove, { passive: true });
  return () => {
    window.removeEventListener("mousemove", onMove);
    if (timer) clearTimeout(timer);
    root.classList.remove("cursor-hidden");
  };
}
