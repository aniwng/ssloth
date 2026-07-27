import {createClient} from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production'
const apiVersion = import.meta.env.PUBLIC_SANITY_API_VERSION || '2024-01-01'

/**
 * True once a real Sanity project exists in .env. Until then the site builds
 * from the local seed content in ./seed/roundups.json so `npm run dev` works
 * on a fresh clone — see roundups.js.
 */
export const sanityConfigured = Boolean(projectId)

export const sanityClient = sanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      // Static build: read published documents straight from the CDN.
      useCdn: true,
      perspective: 'published',
    })
  : null

const builder = sanityClient ? imageUrlBuilder(sanityClient) : null

/** Returns a sized image URL, or null when there's no image / no project yet. */
export function imageUrl(source, {width = 800, height} = {}) {
  if (!source) return null
  // A plain string (e.g. "/images/sunscreens-hero.jpg" in the dev seed
  // content) isn't a Sanity asset — use it as-is rather than running it
  // through the image pipeline below, which expects a Sanity image
  // reference object.
  if (typeof source === 'string') return source
  if (!builder) return null
  let url = builder.image(source).width(width).auto('format').fit('crop')
  if (height) url = url.height(height)
  return url.url()
}
