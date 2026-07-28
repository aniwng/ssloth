import {toHTML} from '@portabletext/to-html'
import {sanityClient, sanityConfigured} from './sanityClient.js'
import seedRoundups from './seed/roundups.json'

export const CATEGORIES = ['health', 'tech', 'home', 'accessories']

// Amazon Associates ID. Not sensitive — it's designed to appear in public
// URLs — so it's safe as a plain default here rather than requiring a CI
// secret, same pattern as astro.config.mjs's SITE_URL fallback.
const AMAZON_ASSOCIATE_TAG = import.meta.env.PUBLIC_AMAZON_ASSOCIATE_TAG || 'shoppingslo03-20'

const ROUNDUP_PROJECTION = `{
  _id,
  title,
  "slug": slug.current,
  category,
  publishedAt,
  updatedAt,
  readingMinutes,
  intro,
  heroImage,
  ranked,
  buyingTips,
  pullQuote,
  products[]{
    rank, name, subtitle, blurb, examples, image, affiliateUrl, isEditorsPick, relatedLinks
  },
  stateDates[]{
    state, dates, rate, note
  }
}`

/**
 * Every roundup, newest first.
 *
 * With no Sanity project configured this falls back to the checked-in seed
 * content so the site still builds. That fallback is a development
 * convenience, not the content model — once PUBLIC_SANITY_PROJECT_ID is set,
 * Sanity is the only source of truth and this file never reads the seed again.
 */
export async function getRoundups() {
  if (!sanityConfigured) return sortRoundups(seedRoundups)

  const roundups = await sanityClient.fetch(
    `*[_type == "roundup" && defined(slug.current)] | order(publishedAt desc) ${ROUNDUP_PROJECTION}`,
  )
  return sortRoundups(roundups)
}

export async function getRoundup(slug) {
  const all = await getRoundups()
  return all.find((r) => r.slug === slug) ?? null
}

export async function getRoundupsByCategory(category) {
  const all = await getRoundups()
  return all.filter((r) => r.category === category)
}

function sortRoundups(roundups) {
  return [...roundups].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

/**
 * Appends the Amazon Associates tag to a real Amazon product URL. Leaves
 * non-Amazon URLs and the "#" placeholder untouched — tagging only applies
 * once a product actually links to Amazon.
 */
export function withAffiliateTag(url) {
  if (!url || url === '#') return url
  try {
    const parsed = new URL(url)
    if (!/(^|\.)amazon\.[a-z.]+$/i.test(parsed.hostname)) return url
    parsed.searchParams.set('tag', AMAZON_ASSOCIATE_TAG)
    return parsed.toString()
  } catch {
    return url
  }
}

/** Portable Text -> HTML. Intros are plain paragraphs plus the occasional link. */
export function introToHtml(intro) {
  if (!intro) return ''
  return toHTML(intro, {
    components: {
      marks: {
        link: ({children, value}) =>
          `<a href="${escapeAttr(value?.href ?? '#')}" rel="nofollow noopener">${children}</a>`,
      },
    },
  })
}

/**
 * Portable Text -> plain text, truncated to a meta-description-friendly
 * length. Used for <meta name="description"> and og:description so every
 * article gets a unique description instead of all sharing BaseLayout's
 * generic default — duplicate descriptions across pages hurt SEO.
 */
export function introToPlainText(intro, maxLength = 155) {
  if (!intro) return ''
  const text = intro
    .flatMap((block) => block.children?.map((child) => child.text) ?? [])
    .join(' ')
    .trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1).replace(/\s+\S*$/, '') + '…'
}

/** "updated jul 2026" — lowercase to match the prototype's voice. */
export function formatMonth(dateish) {
  if (!dateish) return ''
  const date = new Date(dateish)
  if (Number.isNaN(date.getTime())) return ''
  return date
    .toLocaleDateString('en-US', {month: 'short', year: 'numeric', timeZone: 'UTC'})
    .toLowerCase()
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
