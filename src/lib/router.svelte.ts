/**
 * Minimal hash-based router using Svelte 5 $state.
 * Routes: #/ → Landing, #/course/:name → Course, #/course/:name/groups → Groups
 */

type Page = 'landing' | 'course' | 'groups';

interface Route {
  page: Page;
  params: Record<string, string>;
}

export const route: Route = $state({ page: 'landing', params: {} });

function parse_hash(): void {
  const hash = window.location.hash.slice(1) || '/';

  const groups_match = hash.match(/^\/course\/([^/]+)\/groups$/);
  if (groups_match) {
    route.page = 'groups';
    route.params = { name: decodeURIComponent(groups_match[1]) };
    return;
  }

  const course_match = hash.match(/^\/course\/([^/]+)$/);
  if (course_match) {
    route.page = 'course';
    route.params = { name: decodeURIComponent(course_match[1]) };
    return;
  }

  route.page = 'landing';
  route.params = {};
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', parse_hash);
  parse_hash();
}

export function navigate(path: string): void {
  window.location.hash = path;
}
