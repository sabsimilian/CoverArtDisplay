<script lang="ts">
  interface Props {
    checked: boolean;
    onchange: (checked: boolean) => void;
    id?: string;
  }
  let { checked, onchange, id }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label="Toggle"
  {id}
  class="relative inline-block h-6 w-[50px] flex-shrink-0 cursor-pointer rounded-full border-none transition-colors duration-200"
  style="background-color: {checked ? 'var(--accent-color)' : '#444'};"
  onclick={() => onchange(!checked)}
>
  <span
    class="absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform duration-200"
    style="transform: translateX({checked ? '26px' : '0'});"
  ></span>
</button>
