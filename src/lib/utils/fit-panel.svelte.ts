// Drops optional rows from an info-layout panel until its content fits,
// rather than shrinking the important text. `level` counts how many of the
// panel's optional items (in the panel's own priority order) are hidden;
// it's worked out again whenever the panel resizes or deps() changes.

import { tick } from "svelte";

export function fitPanel(maxLevel: number, deps: () => unknown) {
  let level = $state(0);
  let panel = $state<HTMLElement | null>(null);
  let running = false;
  let again = false;

  const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1;

  async function fit(): Promise<void> {
    const el = panel;
    if (!el) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        // All within one task, so the intermediate levels never get painted.
        level = 0;
        await tick();
        while (level < maxLevel && overflows(el)) {
          level++;
          await tick();
        }
      } while (again);
    } finally {
      running = false;
    }
  }

  $effect(() => {
    const el = panel;
    if (!el) return;
    const observer = new ResizeObserver(() => void fit());
    observer.observe(el);
    return () => observer.disconnect();
  });

  $effect(() => {
    deps();
    void fit();
  });

  // Text measured before the web font loaded is the wrong size.
  $effect(() => {
    void document.fonts?.ready.then(() => fit());
  });

  return {
    get level() {
      return level;
    },
    set panel(el: HTMLElement | null) {
      panel = el;
    },
    get panel() {
      return panel;
    },
  };
}
