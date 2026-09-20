import {defineConfig} from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  // SITE_URL env var overrides this for staging/preview deploys.
  site: process.env.SITE_URL || 'https://shoppingsloth.com',
  integrations: [
    sitemap({
      // Keep noindex'd pages out of the sitemap — submitting a URL for
      // indexing and then telling the crawler not to index it is a
      // contradiction that shows up in Search Console as an error. These are
      // the archive pages past the first; see src/pages/roundups/[...page].astro.
      filter: (page) => !/\/roundups\/\d+\/?$/.test(page),
    }),
  ],
  vite: {
    // One .env for the whole scaffold, at sloth-astro-sanity/.env.
    // (The Sanity Studio is the exception — it needs its own, see sanity/.env.example.)
    envDir: '..',
  },
})
