import {defineConfig} from 'astro/config'

export default defineConfig({
  // SITE_URL env var overrides this for staging/preview deploys.
  site: process.env.SITE_URL || 'https://shoppingsloth.com',
  vite: {
    // One .env for the whole scaffold, at sloth-astro-sanity/.env.
    // (The Sanity Studio is the exception — it needs its own, see sanity/.env.example.)
    envDir: '..',
  },
})
