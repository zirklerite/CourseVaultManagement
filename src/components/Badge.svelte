<script lang="ts">
  import type { Snippet } from 'svelte';

  type BadgeVariant = 'ok' | 'never' | 'notfound' | 'error' | 'inactive' | 'neutral';
  let { variant = 'neutral', children }: { variant?: BadgeVariant; children: Snippet } = $props();

  const styles: Record<string, string> = {
    ok: 'bg-success-bg text-success',
    never: 'bg-danger-bg text-danger',
    notfound: 'bg-neutral-bg text-neutral',
    error: 'bg-warning-bg text-warning',
    inactive: 'bg-neutral-bg text-neutral ml-2',
    neutral: 'bg-neutral-bg text-neutral',
  };
</script>

<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.72rem] font-semibold font-body leading-snug {styles[variant] || styles.neutral}">
  {@render children()}
</span>
