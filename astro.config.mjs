import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true }
  }),
  site: 'https://nvidia-tracker.seankel.com',
  build: {
    assets: 'assets'
  },
  vite: {
    ssr: {
      external: ['node:fs', 'node:path', 'node:url']
    }
  }
});
