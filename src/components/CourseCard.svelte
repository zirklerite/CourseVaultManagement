<script lang="ts">
  import type { CourseInfo } from '../lib/api.js';
  let { course }: { course: CourseInfo } = $props();
</script>

<article class="bg-bg-card border border-border-subtle rounded-lg shadow-default overflow-hidden flex flex-col transition-all duration-[--transition-default] hover:shadow-lg hover:-translate-y-[3px] hover:border-border animate-fade-up">
  <header class="px-6 pt-6 pb-3 flex-1">
    <a href="#/course/{course.name}" class="font-heading text-xl font-bold text-primary no-underline tracking-tight hover:text-accent transition-colors duration-[--transition-default] break-all">
      {course.name}
    </a>
  </header>
  <p class="px-6 text-text-muted text-sm mb-3">
    <span class="inline-flex items-center gap-1.5 bg-neutral-bg px-2.5 py-1 rounded-full text-[0.82rem] text-text-muted font-medium">
      <strong class="text-text font-bold text-[0.95rem]">{course.student_count}</strong> students
    </span>
    <span class="inline-flex items-center gap-1.5 bg-neutral-bg px-2.5 py-1 rounded-full text-[0.82rem] text-text-muted font-medium ml-1">
      <strong class="text-text font-bold text-[0.95rem]">{course.group_count}</strong> groups
    </span>
  </p>
  <footer class="px-6 py-4 bg-neutral-bg border-t border-border-subtle flex gap-2">
    <a href="#/course/{course.name}" class="inline-block border border-primary text-primary bg-transparent px-4 py-1.5 rounded-sm text-[0.88rem] font-medium no-underline hover:bg-primary hover:text-white hover:shadow-sm transition-all duration-[--transition-default]">
      View Roster
    </a>
    <a href="#/course/{course.name}/groups" class="inline-block border border-border text-text-muted bg-transparent px-4 py-1.5 rounded-sm text-[0.88rem] font-medium no-underline hover:bg-neutral-bg hover:text-text transition-all duration-[--transition-default]">
      Groups
    </a>
  </footer>
</article>
