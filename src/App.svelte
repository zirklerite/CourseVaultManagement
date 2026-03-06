<script lang="ts">
  import { route } from './lib/router.svelte.js';
  import Nav from './components/Nav.svelte';
  import Landing from './pages/Landing.svelte';
  import Course from './pages/Course.svelte';
  import Groups from './pages/Groups.svelte';

  function nav_links() {
    if (route.page === 'course') {
      return [{ href: `#/course/${route.params.name}/groups`, label: 'Manage Groups' }];
    }
    if (route.page === 'groups') {
      return [{ href: `#/course/${route.params.name}`, label: 'Course Overview' }];
    }
    return [];
  }
</script>

<Nav course_name={route.params.name} links={nav_links()} />

<main class="max-w-[1100px] mx-auto px-4 pt-10 pb-12">
  {#if route.page === 'landing'}
    <Landing />
  {:else if route.page === 'course'}
    {#key route.params.name}
      <Course course_name={route.params.name} />
    {/key}
  {:else if route.page === 'groups'}
    {#key route.params.name}
      <Groups course_name={route.params.name} />
    {/key}
  {/if}
</main>
