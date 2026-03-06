<script lang="ts">
  import { fetch_course, update_student, toggle_student, remove_group, type StudentInfo } from '../lib/api.js';
  import Badge from '../components/Badge.svelte';
  import TeamChip from '../components/TeamChip.svelte';

  let { course_name }: { course_name: string } = $props();

  let students: StudentInfo[] = $state([]);
  let group_names: string[] = $state([]);
  let loading = $state(true);
  let new_team_name = $state('');
  let new_groups: string[] = $state([]);
  let chip_visible: Record<string, boolean> = $state({});
  let filter_query = $state('');
  let select_values: Record<number, string> = $state({});

  async function load(): Promise<void> {
    loading = true;
    const data = await fetch_course(course_name);
    students = data.students;
    group_names = data.groups;
    const vis: Record<string, boolean> = {};
    vis['Unassigned'] = true;
    for (const g of data.groups) vis[g] = true;
    for (const g of new_groups) vis[g] = true;
    chip_visible = vis;
    loading = false;
  }

  $effect(() => {
    const _ = course_name;
    load();
  });

  function grouped() {
    const groups = new Map();
    const unassigned = [];
    for (const s of students) {
      if (s.group_name) {
        if (!groups.has(s.group_name)) groups.set(s.group_name, []);
        groups.get(s.group_name).push(s);
      } else {
        unassigned.push(s);
      }
    }
    return { groups, unassigned };
  }

  function create_team() {
    const name = new_team_name.trim();
    if (!name) return;
    if (group_names.includes(name) || new_groups.includes(name)) return;
    new_groups = [...new_groups, name];
    chip_visible = { ...chip_visible, [name]: true };
    new_team_name = '';
  }

  function toggle_chip(name) {
    chip_visible = { ...chip_visible, [name]: !chip_visible[name] };
  }

  async function assign_team(line) {
    const group_name = select_values[line];
    if (!group_name) return;
    await update_student(course_name, line, { group_name });
    await load();
  }

  async function do_remove(line) {
    await remove_group(course_name, line);
    await load();
  }

  async function do_toggle(line) {
    await toggle_student(course_name, line);
    await load();
  }

  function filtered_unassigned(list) {
    if (!filter_query) return list;
    const q = filter_query.toLowerCase();
    return list.filter(s => s.student_id.toLowerCase().includes(q) || s.student_name.toLowerCase().includes(q));
  }

  function all_group_options() {
    return [...group_names, ...new_groups];
  }
</script>

<div class="animate-fade-down mb-8">
  <h1 class="text-3xl mb-1">Group Management</h1>
  <p class="text-text-muted text-[0.95rem]">
    <a href="#/" class="text-accent no-underline font-medium hover:text-accent-hover transition-colors duration-[--transition-default]">Courses</a>
    / <a href="#/course/{course_name}" class="text-accent no-underline font-medium hover:text-accent-hover transition-colors duration-[--transition-default]">{course_name}</a>
    / Groups
  </p>
</div>

{#if loading}
  <p class="text-text-muted">Loading groups...</p>
{:else}
  {@const { groups, unassigned } = grouped()}

  <!-- Create Group -->
  <div class="flex gap-3 items-center mb-3">
    <input
      bind:value={new_team_name}
      placeholder="New group name"
      class="flex-1 px-3 py-2 border border-border rounded-sm text-sm font-body focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-[--transition-default]"
      onkeydown={(e) => e.key === 'Enter' && create_team()}
    >
    <button
      onclick={create_team}
      class="whitespace-nowrap border border-primary text-primary bg-transparent px-4 py-2 rounded-sm text-[0.88rem] font-medium cursor-pointer hover:bg-primary hover:text-white hover:shadow-sm transition-all duration-[--transition-default]"
    >Create Group</button>
  </div>

  <!-- Chips -->
  <div class="flex flex-wrap gap-1.5 mb-5">
    <TeamChip name="Unassigned{unassigned.length ? ` (${unassigned.length})` : ''}" active={chip_visible['Unassigned']} onclick={() => toggle_chip('Unassigned')} />
    {#each group_names as g}
      <TeamChip name={g} active={chip_visible[g]} onclick={() => toggle_chip(g)} />
    {/each}
    {#each new_groups as g}
      <TeamChip name={g} active={chip_visible[g]} variant="new" onclick={() => toggle_chip(g)} />
    {/each}
  </div>

  <hr class="border-0 border-t border-border-subtle my-2 mb-6">

  <!-- Unassigned -->
  {#if unassigned.length > 0 && chip_visible['Unassigned']}
    <article class="bg-bg-card border border-border-subtle rounded-lg shadow-default mb-5 overflow-hidden animate-fade-up" data-team="Unassigned">
      <header class="bg-neutral-bg border-b border-border-subtle px-6 py-4">
        <strong class="font-heading text-lg text-primary font-semibold tracking-tight">Unassigned</strong>
        <span class="inline-block bg-accent-soft text-accent-hover text-[0.78rem] font-semibold px-2.5 py-0.5 rounded-full ml-2 align-middle">
          {unassigned.length} student{unassigned.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div class="px-4 py-3">
        <input
          bind:value={filter_query}
          type="text"
          placeholder="Filter by ID or name..."
          class="w-full max-w-xs px-3 py-2 border border-border rounded-sm text-sm font-body focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-[--transition-default]"
        >
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Student ID</th>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Name</th>
              <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filtered_unassigned(unassigned) as s}
              <tr class="transition-colors duration-[--transition-default] hover:bg-primary/[0.02] {s.active ? '' : 'opacity-45 hover:opacity-70'}">
                <td class="px-4 py-3 border-b border-border-subtle">{s.student_id}</td>
                <td class="px-4 py-3 border-b border-border-subtle">
                  {s.student_name}
                  {#if !s.active}<Badge variant="inactive">Inactive</Badge>{/if}
                </td>
                <td class="px-4 py-3 border-b border-border-subtle whitespace-nowrap">
                  <select
                    bind:value={select_values[s.line]}
                    class="inline-block w-auto min-w-[140px] px-2.5 py-1.5 m-0.5 rounded-sm border border-border text-[0.82rem] font-body bg-bg-card cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                  >
                    <option value="" disabled selected>Select group...</option>
                    {#each all_group_options() as g}
                      <option value={g}>{g}</option>
                    {/each}
                  </select>
                  <button
                    onclick={() => assign_team(s.line)}
                    class="border border-primary text-primary bg-transparent px-3 py-1 rounded-sm text-[0.78rem] font-medium cursor-pointer m-0.5 hover:bg-primary hover:text-white transition-all duration-[--transition-default]"
                  >Assign</button>
                  <button
                    onclick={() => do_toggle(s.line)}
                    class="border border-danger text-danger bg-transparent px-3 py-1 rounded-sm text-[0.78rem] font-medium cursor-pointer m-0.5 hover:bg-danger hover:text-white transition-all duration-[--transition-default]"
                  >{s.active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </article>
  {/if}

  <!-- Group sections -->
  {#each [...groups.entries()] as [group_name, members]}
    {#if chip_visible[group_name]}
      <article class="bg-bg-card border border-border-subtle rounded-lg shadow-default mb-5 overflow-hidden animate-fade-up {new_groups.includes(group_name) ? '' : ''}" data-team={group_name}>
        <header class="border-b px-6 py-4 {new_groups.includes(group_name) ? 'bg-purple-soft border-purple-soft' : 'bg-neutral-bg border-border-subtle'}">
          <strong class="font-heading text-lg font-semibold tracking-tight {new_groups.includes(group_name) ? 'text-purple-hover' : 'text-primary'}">{group_name}</strong>
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
                <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each members as s}
                <tr class="transition-colors duration-[--transition-default] hover:bg-primary/[0.02] {s.active ? '' : 'opacity-45 hover:opacity-70'}">
                  <td class="px-4 py-3 border-b border-border-subtle">{s.student_id}</td>
                  <td class="px-4 py-3 border-b border-border-subtle">
                    {s.student_name}
                    {#if !s.active}<Badge variant="inactive">Inactive</Badge>{/if}
                  </td>
                  <td class="px-4 py-3 border-b border-border-subtle whitespace-nowrap">
                    <button
                      onclick={() => do_remove(s.line)}
                      class="border border-border text-text-muted bg-transparent px-3 py-1 rounded-sm text-[0.78rem] font-medium cursor-pointer m-0.5 hover:bg-neutral-bg hover:text-text transition-all duration-[--transition-default]"
                    >Remove</button>
                    <button
                      onclick={() => do_toggle(s.line)}
                      class="border border-danger text-danger bg-transparent px-3 py-1 rounded-sm text-[0.78rem] font-medium cursor-pointer m-0.5 hover:bg-danger hover:text-white transition-all duration-[--transition-default]"
                    >{s.active ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </article>
    {/if}
  {/each}

  <!-- Empty new groups (no members yet) -->
  {#each new_groups.filter(g => !groups.has(g)) as g}
    {#if chip_visible[g]}
      <article class="bg-bg-card border border-border-subtle rounded-lg shadow-default mb-5 overflow-hidden animate-fade-up" data-team={g}>
        <header class="bg-purple-soft border-b border-purple-soft px-6 py-4">
          <strong class="font-heading text-lg text-purple-hover font-semibold tracking-tight">{g}</strong>
          <span class="inline-block bg-accent-soft text-accent-hover text-[0.78rem] font-semibold px-2.5 py-0.5 rounded-full ml-2 align-middle">0 students</span>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Student ID</th>
                <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Name</th>
                <th class="bg-bg text-text-muted font-body font-semibold text-[0.78rem] uppercase tracking-wider px-4 py-3 border-b-2 border-border text-left whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </article>
    {/if}
  {/each}
{/if}
