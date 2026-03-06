import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import csvApiPlugin from './vite-plugin-csv-api.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const giteaUrl = (env.VITE_GITEA_URL || env.GITEA_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return {
    plugins: [
      svelte(),
      tailwindcss(),
      csvApiPlugin(),
    ],
    build: {
      minify: 'terser',
    },
    server: {
      proxy: {
        '/gitea': {
          target: giteaUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gitea/, ''),
        },
      },
    },
  };
});
