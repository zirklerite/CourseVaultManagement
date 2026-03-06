<script lang="ts">
  let { name, active = true, variant = 'default', onclick }: { name: string; active?: boolean; variant?: 'default' | 'new'; onclick?: () => void } = $props();
</script>

<button
  type="button"
  class="inline-block px-3 py-1 rounded-full text-[0.8rem] font-medium font-body cursor-pointer select-none border transition-all duration-[--transition-default]
    {active
      ? variant === 'new'
        ? 'bg-purple text-white border-purple opacity-100 hover:bg-purple-hover hover:border-purple-hover'
        : 'bg-primary text-white border-primary opacity-100 hover:bg-primary-hover hover:border-primary-hover'
      : variant === 'new'
        ? 'bg-purple-soft text-purple border-purple-soft opacity-50 hover:opacity-75'
        : 'bg-neutral-bg text-text-faint border-border-subtle opacity-50 hover:opacity-75'
    }"
  onclick={onclick}
>
  {name}
</button>
