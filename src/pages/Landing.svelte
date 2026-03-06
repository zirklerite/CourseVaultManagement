<script lang="ts">
  import { fetch_courses, type CourseInfo } from '../lib/api.js';
  import CourseCard from '../components/CourseCard.svelte';

  let courses: CourseInfo[] = $state([]);
  let loading = $state(true);

  $effect(() => {
    fetch_courses().then(data => { courses = data; loading = false; });
  });
</script>

<div class="animate-fade-down mb-8">
  <h1 class="text-3xl mb-1">Courses</h1>
  <p class="text-text-muted text-[0.95rem]">Manage your course rosters and groups</p>
</div>

{#if loading}
  <p class="text-text-muted">Loading courses...</p>
{:else if courses.length === 0}
  <div class="text-center py-12 text-text-muted">
    <div class="text-4xl mb-3 opacity-50">&#128218;</div>
    <p>No courses found. Add a CSV file to get started.</p>
  </div>
{:else}
  <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 mt-6">
    {#each courses as course, i}
      <div style="animation-delay: {(i + 1) * 0.05}s">
        <CourseCard {course} />
      </div>
    {/each}
  </div>
{/if}
