import {toHTML} from '@portabletext/to-html'
import {sanityClient, sanityConfigured} from './sanityClient.js'
import seedRoundups from './seed/roundups.json'

export const CATEGORIES = ['beauty', 'tech', 'home', 'accessories']

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
    rank, name, subtitle, blurb, examples, image, affiliateUrl, isEditorsPick
  },
  stateDates[]{
    state, dates, note
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
