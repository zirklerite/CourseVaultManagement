<script lang="ts">
  import { fetch_course, type StudentInfo } from '../lib/api.js';
  import { get_login_status, type LoginStatus } from '../lib/gitea.js';
  import Badge from '../components/Badge.svelte';

  let { course_name }: { course_name: string } = $props();

  let students: StudentInfo[] = $state([]);
  let groups_list: string[] = $state([]);
  let login_status: Record<string, LoginStatus> = $state({});
  let loading = $state(true);

  $effect(() => {
    loading = true;
    const name = course_name;
    fetch_course(name).then(data => {
      students = data.students;
      groups_list = data.groups;
      loading = false;

      const ids = data.students.map(s => s.student_id);
      get_login_status(ids).then(status => { login_status = status; });
    });
  });

  function grouped() {
    const groups = new Map<string, StudentInfo[]>();
    const unassigned: StudentInfo[] = [];
    for (const s of students) {
      if (s.group_name) {
        if (!groups.has(s.group_name)) groups.set(s.group_name, []);
        groups.get(s.group_name)!.push(s);
      } else {
        unassigned.push(s);
      }
    }
    return { groups, unassigned };
  }

  function login_badge(sid: string) {
    const ls = login_status[sid];
    if (!ls || !ls.exists) return { variant: 'notfound', text: 'Not found' };
    if (ls.logged_in) return { variant: 'ok', text: `Logged in`, date: new Date(ls.last_login).toLocaleDateString() };
    return { variant: 'never', text: 'Never' };
  }
</script>

<div class="animate-fade-down mb-8">
  <h1 class="text-3xl mb-1">{course_name}</h1>
  <p class="text-text-muted text-[0.95rem]">
    <a href="#/" class="text-accent no-underline font-medium hover:text-accent-hover transition-colors duration-[--transition-default]">Courses</a> / Roster Overview
  </p>
</div>

{#if loading}
  <p class="text-text-muted">Loading roster...</p>
{:else}
  {@const { groups, unassigned } = grouped()}

  {#each [...groups.entries()] as [group_name, members], i}
    <article class="bg-bg-card border border-border-subtle rounded-lg shadow-default mb-5 overflow-hidden animate-fade-up" style="animation-delay: {(i + 1) * 0.05}s">
      <header class="bg-neutral-bg border-b border-border-subtle px-6 py-4">
        <strong class="font-heading text-lg text-primary font-semibold tracking-tight">{group_name}</strong>
        <span class="inline-block bg-accent-soft text-accent-hover text-[0.78rem] font-semibold px-2.5 py-0.5 rounded-full ml-2 align-middle">
          {members.length} student{members.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Student ID</th>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Name</th>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Login Status</th>
            </tr>
          </thead>
          <tbody>
            {#each members as s}
              {@const b = login_badge(s.student_id)}
              <tr class="transition-colors duration-[--transition-default] hover:bg-primary/[0.02] {s.active ? '' : 'opacity-45 hover:opacity-70'}">
                <td class="px-4 py-3 border-b border-border-subtle">{s.student_id}</td>
                <td class="px-4 py-3 border-b border-border-subtle">
                  {s.student_name}
                  {#if !s.active}<Badge variant="inactive">Inactive</Badge>{/if}
                </td>
                <td class="px-4 py-3 border-b border-border-subtle">
                  {#if login_status[s.student_id]}
                    <Badge variant={b.variant}>{b.text}</Badge>
                    {#if b.date}<span class="text-text-muted text-xs ml-1">{b.date}</span>{/if}
                  {:else}
                    <span class="inline-block w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin"></span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </article>
  {/each}

  {#if unassigned.length > 0}
    <article class="bg-bg-card border border-border-subtle rounded-lg shadow-default mb-5 overflow-hidden animate-fade-up">
      <header class="bg-neutral-bg border-b border-border-subtle px-6 py-4">
        <strong class="font-heading text-lg text-primary font-semibold tracking-tight">Unassigned</strong>
        <span class="inline-block bg-accent-soft text-accent-hover text-[0.78rem] font-semibold px-2.5 py-0.5 rounded-full ml-2 align-middle">
          {unassigned.length} student{unassigned.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Student ID</th>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Name</th>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Login Status</th>
            </tr>
          </thead>
          <tbody>
            {#each unassigned as s}
              {@const b = login_badge(s.student_id)}
              <tr class="transition-colors duration-[--transition-default] hover:bg-primary/[0.02] {s.active ? '' : 'opacity-45 hover:opacity-70'}">
                <td class="px-4 py-3 border-b border-border-subtle">{s.student_id}</td>
                <td class="px-4 py-3 border-b border-border-subtle">
                  {s.student_name}
                  {#if !s.active}<Badge variant="inactive">Inactive</Badge>{/if}
                </td>
                <td class="px-4 py-3 border-b border-border-subtle">
                  {#if login_status[s.student_id]}
                    <Badge variant={b.variant}>{b.text}</Badge>
                    {#if b.date}<span class="text-text-muted text-xs ml-1">{b.date}</span>{/if}
                  {:else}
                    <span class="inline-block w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin"></span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </article>
  {/if}
{/if}
