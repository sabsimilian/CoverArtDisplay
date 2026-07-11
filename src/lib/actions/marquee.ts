// Ports V1's applyTextScroll() marquee: text that overflows its container
// scrolls left, pauses, then snaps back — rather than looping continuously
// (which would make small text jitter constantly on a kiosk display). Same
// algorithm (30px/s, 1.5s pause each end), packaged as a Svelte action so
// every song/artist/album element gets it via `use:marquee={text}` instead
// of V1's hand-rolled per-element bookkeeping.

const keyframeRules = new Map<string, string>();
let styleEl: HTMLStyleElement | null = null;

function flushKeyframes(): void {
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "marquee-keyframes";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = Array.from(keyframeRules.values()).join("\n");
}

// A per-mount-cycle incrementing counter collided across dev-server HMR
// reloads: the counter resets to 0 on reload, but already-mounted rows keep
// their old ids, so a freshly (re)mounted row could grab the same id as one
// still on screen and silently overwrite its @keyframes rule in the shared
// map. crypto.randomUUID() can never collide, in dev or prod.
function uniqueId(): string {
  return `marquee-${crypto.randomUUID()}`;
}

export function marquee(node: HTMLElement, text: string | null | undefined) {
  const id = uniqueId();
  let currentText = text ?? "";
  let endListener: (() => void) | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  function measure(): void {
    if (endListener) {
      node.removeEventListener("animationend", endListener);
      endListener = null;
    }
    node.style.animation = "none";
    node.style.transform = "none";
    void node.offsetWidth; // force reflow before remeasuring

    const parent = node.parentElement;
    if (!parent) return;
    const parentStyle = getComputedStyle(parent);
    const paddingX = parseFloat(parentStyle.paddingLeft) + parseFloat(parentStyle.paddingRight);
    const availableWidth = parent.clientWidth - paddingX;
    const rawOverflow = node.scrollWidth - availableWidth;

    if (rawOverflow <= 0) {
      // Fits fully — let it use whatever alignment/overflow the surrounding
      // component (e.g. text-center) actually intends; nothing to clip.
      node.style.textAlign = "";
      node.style.overflow = "";
      node.style.textOverflow = "clip";
      keyframeRules.delete(id);
      flushKeyframes();
      return;
    }

    // Overflowing text always reads left-to-right regardless of the
    // component's normal alignment (center-aligned song/artist/album rows
    // included). This isn't just cosmetic: the scroll math below assumes
    // translateX(0) shows the text's true left edge and translateX(-overflow)
    // shows its true right edge flush against the clip boundary. With
    // text-align:center, the browser instead centers the (wider) line
    // within the box — so at rest, HALF the overflow is already hidden off
    // each side, the animation never actually reaches the true start, and it
    // overshoots past the true end. Forcing left alignment here is what
    // makes "the whole text becomes readable across one pass" true.
    node.style.textAlign = "left";

    // Resting (not actively sliding) state clips on this element itself so
    // text-overflow:ellipsis can render a clean "…" — the state on screen
    // before the scroll kicks in and again once it settles back afterward,
    // covering most of the time relative to the brief scroll itself.
    node.style.overflow = "hidden";
    node.style.textOverflow = "ellipsis";

    // A few extra pixels past the exact measured overflow — sub-pixel font
    // metrics can otherwise leave the last character looking flush against
    // (or very slightly clipped by) the edge once fully scrolled.
    const overflow = rawOverflow + 4;

    const pixelsPerSecond = 30;
    const pauseAtStart = 1.5;
    const pauseAtEnd = 1.5;
    const scrollDuration = overflow / pixelsPerSecond;
    const totalDuration = pauseAtStart + scrollDuration + pauseAtEnd;
    const startPercent = (pauseAtStart / totalDuration) * 100;
    const endPercent = ((pauseAtStart + scrollDuration) / totalDuration) * 100;
    const scrollDistance = -overflow;

    keyframeRules.set(
      id,
      `@keyframes ${id} {
        0% { transform: translateX(0); }
        ${startPercent}% { transform: translateX(0); }
        ${endPercent}% { transform: translateX(${scrollDistance}px); }
        99.999% { transform: translateX(${scrollDistance}px); }
        100% { transform: translateX(0); }
      }`,
    );
    flushKeyframes();

    node.style.animation = `${id} ${totalDuration}s linear 1 forwards`;
    // Clipping has to come from the *parent* while this element is actually
    // sliding, not from this element's own overflow:hidden — an element
    // can't reveal new content of its own via a transform applied to
    // itself, since its clip boundary moves rigidly along with it (same
    // box, same transform). Handing clipping to the parent (MetadataStrip's
    // clip container, which already has overflow:hidden) lets translateX
    // actually change which slice of the text is visible. Also drop the
    // ellipsis — it's baked into this element's own static layout, so left
    // on during the slide it would ride along with the transform instead of
    // the real trailing text.
    node.style.overflow = "visible";
    node.style.textOverflow = "clip";
    endListener = () => {
      node.style.animation = "none";
      node.style.transform = "none";
      node.style.overflow = "hidden";
      node.style.textOverflow = "ellipsis";
    };
    node.addEventListener("animationend", endListener, { once: true });
  }

  // V1 (see changeMetadata() in renderer.js) never measures synchronously —
  // it sets textContent immediately, then measures via `setTimeout(fn, 100)`
  // on every single metadata change, not just once at mount. That's load
  // bearing, not a stylistic choice: Svelte's action `update()` hook and its
  // `{text}` child-content binding are two independent reactive bindings on
  // the same element, and nothing guarantees the DOM's textContent has
  // actually been written by the time `update()` runs. Measuring
  // `node.scrollWidth` immediately could therefore read the *previous*
  // track's text width — a stale short-vs-long mismatch that looked exactly
  // like "short text scrolls, long text doesn't" depending on which way the
  // two lengths happened to differ. Deferring every measurement by the same
  // 100ms, with no immediate call at all, matches V1 exactly and sidesteps
  // the ordering question entirely.
  function scheduleMeasure(): void {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(measure, 100);
  }

  scheduleMeasure();

  return {
    update(newText: string | null | undefined) {
      const next = newText ?? "";
      if (next === currentText) return;
      currentText = next;
      scheduleMeasure();
    },
    destroy() {
      if (pendingTimer) clearTimeout(pendingTimer);
      if (endListener) node.removeEventListener("animationend", endListener);
      keyframeRules.delete(id);
      flushKeyframes();
    },
  };
}
