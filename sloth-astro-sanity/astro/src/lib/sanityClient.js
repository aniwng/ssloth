import {createClient} from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production'
const apiVersion = import.meta.env.PUBLIC_SANITY_API_VERSION || '2024-01-01'
// Server/build-time only — deliberately not PUBLIC_-prefixed so Vite never
// ships it to the browser. The "production" dataset denies anonymous reads
// on the roundup type even though it's marked public, so a scoped Viewer
// token is what actually makes reads work; see SANITY_READ_TOKEN in
// .env.example for the full story.
const readToken = import.meta.env.SANITY_READ_TOKEN

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
      // A token forces a live (non-CDN) read — appropriate here since the
      // token is the whole reason reads work at all, not an optional speed
      // trade-off.
      useCdn: !readToken,
      perspective: 'published',
      ...(readToken ? {token: readToken} : {}),
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
