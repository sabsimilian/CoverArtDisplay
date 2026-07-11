<script lang="ts">
  import { login } from "$lib/state/auth.svelte";
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#121212] px-10 text-center">
  <h2 class="text-2xl font-bold">Spotify Cover Art Display</h2>
  <p class="max-w-sm text-white/70">
    Connect to your Spotify account to display your currently playing track.
  </p>
  <button
    onclick={() => login()}
    class="mt-2 cursor-pointer rounded-full px-8 py-3 text-base font-bold text-white transition-all duration-200 hover:brightness-110 hover:scale-105"
    style="background-color: var(--accent-color);"
  >
    Connect to Spotify
  </button>
</div>
