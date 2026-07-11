// Auth state — replaces V1's showLoadingView()/showLoginView()/showPlayerView()
// trio and the ad-hoc checkAuth()/onAuthComplete()/onAuthError() wiring
// scattered through the DOMContentLoaded handler. One reactive value; every
// consumer (the clock, the view router, etc.) just reads `auth.state`.

import { spotifyApi } from "../tauri/api";

export type AuthState = "loading" | "login" | "authed";

let state = $state<AuthState>("loading");

export const auth = {
  get state() {
    return state;
  },
};

let initialized = false;

// Called once from the root page on mount. Safe to call again (e.g. from
// the settings popup, which never needs auth) — it's a no-op after the
// first call.
export async function initAuth(): Promise<void> {
  if (initialized) return;
  initialized = true;

  await spotifyApi.onAuthComplete((success) => {
    state = success ? "authed" : "login";
  });
  await spotifyApi.onAuthError(() => {
    state = "login";
  });

  try {
    const isAuthorized = await spotifyApi.checkAuth();
    state = isAuthorized ? "authed" : "login";
  } catch {
    state = "login";
  }
}

export async function login(): Promise<void> {
  await spotifyApi.startAuth();
}

export async function logout(): Promise<void> {
  // The Rust `logout` command already reloads the main window itself once
  // tokens are cleared (see src-tauri/src/lib.rs) — no local state flip
  // needed here, mirroring V1's behavior.
  await spotifyApi.logout();
}
