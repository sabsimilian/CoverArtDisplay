// Hides the mouse cursor until the mouse actually moves, and again after a
// few seconds of stillness — like a video player. On a dedicated display
// (e.g. a Pi running only this app) there's often no mouse at all, yet the
// compositor still draws a cursor that pops up over the cover art whenever
// the element under it changes; this keeps it out of the way everywhere.

const HIDE_AFTER_MS = 3000;

export function startCursorAutoHide(): () => void {
  const root = document.documentElement;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const hide = () => root.classList.add("cursor-hidden");
  const onMove = () => {
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
