<script lang="ts">
  import { dialogQueue, resolveDialog } from "$lib/state/dialog.svelte";

  const current = $derived(dialogQueue.current);
</script>

{#if current}
  <div class="fixed inset-0 z-[10300] flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div class="mx-6 w-full max-w-sm rounded-2xl border border-white/10 bg-[#191919] p-6 shadow-2xl">
      <p class="text-sm whitespace-pre-line text-white/90">{current.message}</p>
      <div class="mt-5 flex justify-end gap-2">
        {#if current.kind === "confirm"}
          <button
            class="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10"
            onclick={() => resolveDialog(false)}
          >
            Cancel
          </button>
        {/if}
        <button
          class="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          style="background-color: var(--accent-color);"
          onclick={() => resolveDialog(true)}
        >
          OK
        </button>
      </div>
    </div>
  </div>
{/if}
