// Generic localStorage-backed reactive value — replaces V1's one large
// hand-written loadSettingsFromStorage()/saveSettingsToStorage() pair that
// had to be kept in sync by hand every time a setting was added or removed.
// Each setting just calls persisted(key, default) once; reading/writing the
// returned `.value` auto-persists, no central serialize function to touch.

export function persisted<T>(key: string, initial: T) {
  let value = $state<T>(load());

  function load(): T {
    if (typeof localStorage === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      // Merge onto `initial` rather than trusting the stored blob verbatim —
      // otherwise a field added after a user's settings were first saved
      // (like controlsEnabled) reads back as undefined instead of falling
      // back to its default.
      return { ...initial, ...JSON.parse(raw) } as T;
    } catch {
      return initial;
    }
  }

  // Cross-window sync: the settings popup window (opened via
  // open_settings_window in the Rust backend) writes to the same localStorage
  // key from a separate WebviewWindow. The browser's `storage` event only
  // fires in *other* windows than the one that wrote the change, which is
  // exactly what we want here — pick up their write without echoing our own.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      value = load();
    });
  }

  return {
    get value(): T {
      return value;
    },
    set value(next: T) {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage full/unavailable — keep the in-memory value, just skip persisting.
      }
    },
  };
}
