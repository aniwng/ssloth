export const CATEGORIES = ['health', 'tech', 'home', 'accessories']

/**
 * The shape Claude must return, enforced by the API via
 * output_config.format. Mirrors sanity/schemas/roundup.js minus the fields
 * a language model has no business inventing:
 *
 *   - affiliateUrl  — set to "#" here until an affiliate program is connected
 *   - heroImage / product images — image sourcing is still an open decision
 *   - publishedAt   — comes from the content calendar row
 *
 * Note the JSON-schema subset: no minLength/maxLength/minItems. Those are
 * unsupported by structured outputs, so count and length checks live in
 * validateRoundup() below.
 */
export const ROUNDUP_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'slug', 'category', 'readingMinutes', 'intro', 'products', 'buyingTips', 'pullQuote', 'sources'],
  properties: {
    title: {
      type: 'string',
      description: 'Article title, e.g. "Top 5 Sunscreens for Your Body in 2026". Under 90 characters.',
    },
    slug: {type: 'string', description: 'Lowercase kebab-case URL slug matching the title.'},
    category: {type: 'string', enum: CATEGORIES},
    readingMinutes: {type: 'integer', description: 'Estimated reading time, 4-8.'},
    intro: {
      type: 'array',
      description: 'Exactly two intro paragraphs in the Shopping Sloth voice. Plain text, no markdown.',
      items: {type: 'string'},
    },
    products: {
      type: 'array',
      description: 'Exactly five products, ranked 1-5, exactly one marked as the editor’s pick.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rank', 'name', 'subtitle', 'blurb', 'isEditorsPick'],
        properties: {
          rank: {type: 'integer', description: '1 through 5, each used once.'},
          name: {type: 'string', description: 'Exact product name as sold.'},
          subtitle: {
            type: 'string',
            description: 'Lowercase superlative, e.g. "best overall body sunscreen". Under 60 characters.',
          },
          blurb: {
            type: 'string',
            description:
              'Two to three sentences, paraphrased from reviews in your own words. Never quote or copy source text.',
          },
          isEditorsPick: {type: 'boolean'},
        },
      },
    },
    buyingTips: {
      type: 'string',
      description: 'One short paragraph of practical buying guidance for this category.',
    },
    pullQuote: {
      type: 'string',
      description: 'One dry, self-aware closing line in the sloth voice. No quotation marks.',
    },
    sources: {
      type: 'array',
      description: 'The review sources you actually consulted, for the human reviewer to spot-check.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'url'],
        properties: {
          title: {type: 'string'},
          url: {type: 'string'},
        },
      },
    },
  },
}

/** Checks structured outputs can't express. Throws on the first problem found. */
export function validateRoundup(draft) {
  const problems = []

  if (!draft.title || draft.title.length > 90) problems.push('title missing or over 90 characters')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug ?? '')) problems.push(`slug is not kebab-case: ${draft.slug}`)
  if (!CATEGORIES.includes(draft.category)) problems.push(`unknown category: ${draft.category}`)
  if (!Array.isArray(draft.intro) || draft.intro.length !== 2) problems.push('intro must be exactly 2 paragraphs')

  const products = draft.products ?? []
  if (products.length !== 5) problems.push(`expected 5 products, got ${products.length}`)

  const ranks = products.map((p) => p.rank).sort((a, b) => a - b)
  if (ranks.join(',') !== '1,2,3,4,5') problems.push(`ranks must be 1-5 with no repeats, got ${ranks.join(',')}`)

  const picks = products.filter((p) => p.isEditorsPick)
  if (picks.length !== 1) problems.push(`expected exactly 1 editor's pick, got ${picks.length}`)

  for (const product of products) {
    if (!product.name?.trim()) problems.push(`product ${product.rank} has no name`)
    if ((product.subtitle ?? '').length > 60) problems.push(`product ${product.rank} subtitle over 60 chars`)
    if ((product.blurb ?? '').split(/\s+/).length < 20) problems.push(`product ${product.rank} blurb is too thin`)
  }

  if (!draft.sources?.length) problems.push('no sources returned — content is ungrounded')

  if (problems.length) {
    throw new Error(`Draft failed validation:\n  - ${problems.join('\n  - ')}`)
  }
  return draft
}

/**
 * Claude's JSON -> a Sanity `roundup` document.
 * Draft ids use Sanity's `drafts.` prefix so nothing goes live by accident.
 */
export function toSanityDocument(draft, {row, publish}) {
  const now = new Date().toISOString()
  const publishedAt = row.publish_date ? new Date(`${row.publish_date}T09:00:00Z`).toISOString() : now
  const id = `roundup.${draft.slug}`

  return {
    _id: publish ? id : `drafts.${id}`,
    _type: 'roundup',
    title: draft.title,
    slug: {_type: 'slug', current: draft.slug},
    category: draft.category,
    publishedAt,
    updatedAt: now,
    readingMinutes: draft.readingMinutes,
    intro: draft.intro.map((text, index) => ({
      _type: 'block',
      _key: `intro${index}`,
      style: 'normal',
      markDefs: [],
      children: [{_type: 'span', _key: `intro${index}s`, text, marks: []}],
    })),
    products: draft.products
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((product) => ({
        _type: 'product',
        _key: `product${product.rank}`,
        rank: product.rank,
        name: product.name,
        subtitle: product.subtitle,
        blurb: product.blurb,
        // Placeholder until an affiliate program is connected (CLAUDE.md task 4).
        affiliateUrl: '#',
        isEditorsPick: Boolean(product.isEditorsPick),
      })),
    buyingTips: draft.buyingTips,
    pullQuote: draft.pullQuote,
  }
}
