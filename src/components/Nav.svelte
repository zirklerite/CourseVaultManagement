<script lang="ts">
  interface NavLink { href: string; label: string; }
  let { course_name = null, links = [] }: { course_name?: string | null; links?: NavLink[] } = $props();
</script>

<nav class="sticky top-0 z-50 bg-bg-nav backdrop-blur-[16px] backdrop-saturate-[180%] border-b border-border-subtle px-6 py-2.5 w-full">
  <div class="flex justify-between items-center max-w-[1100px] mx-auto">
    <a href="#/" class="font-heading text-lg font-bold text-primary tracking-tight no-underline">
      <strong class="brand-dot">CourseVault</strong>
    </a>
    <div class="flex gap-2 items-center">
      {#each links as link}
        <a href={link.href} class="text-sm font-medium text-text-muted no-underline px-2.5 py-1.5 rounded-sm hover:text-primary hover:bg-neutral-bg transition-all duration-[--transition-default]">
          {link.label}
        </a>
      {/each}
    </div>
  </div>
</nav>
