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
  required: [
    'title',
    'slug',
    'category',
    'readingMinutes',
    'intro',
    'products',
    'buyingTips',
    'pullQuote',
    'sources',
    'faqs',
  ],
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
        // keySpecs is deliberately NOT required — a model with nothing
        // confirmable to put there should omit it rather than invent numbers.
        // bestFor/skipIf are required: a roundup where nothing has a downside
        // is the exact "no original value" pattern we're trying to leave behind.
        required: ['rank', 'name', 'subtitle', 'blurb', 'bestFor', 'skipIf', 'isEditorsPick'],
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
          keySpecs: {
            type: 'string',
            description:
              'The two or three figures a buyer compares, as one line, e.g. "7in display · 16GB · ' +
              '~10 weeks battery · 211g". Only specs confirmable from the manufacturer or a source ' +
              'you actually consulted. Never prices. Omit rather than guess.',
          },
          bestFor: {
            type: 'string',
            description:
              'One clause naming who this suits, e.g. "you want the safest default and do not want ' +
              'to think about it". No hype.',
          },
          skipIf: {
            type: 'string',
            description:
              'One clause naming who should NOT buy this — a real drawback, not a fake one. Every ' +
              'product must have a genuine reason someone would pass on it.',
          },
          isEditorsPick: {type: 'boolean'},
        },
      },
    },
    faqs: {
      type: 'array',
      description:
        'Three to five questions a real buyer in this category has, answered in two or three ' +
        'sentences. Answer what the roundup does not already cover — not "which is best?".',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer'],
        properties: {
          question: {type: 'string'},
          answer: {type: 'string'},
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

/**
 * The shape the enrichment pass returns — the supporting fields only, for an
 * article whose picks and prose already exist. See buildEnrichPrompt.
 */
export const ENRICHMENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sources', 'faqs', 'products'],
  properties: {
    sources: ROUNDUP_JSON_SCHEMA.properties.sources,
    faqs: ROUNDUP_JSON_SCHEMA.properties.faqs,
    products: {
      type: 'array',
      description: 'One entry per existing pick, identified by its published rank. Do not reorder or rename.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rank', 'bestFor', 'skipIf'],
        properties: {
          rank: {type: 'integer', description: 'The published rank of the pick this applies to.'},
          bestFor: ROUNDUP_JSON_SCHEMA.properties.products.items.properties.bestFor,
          skipIf: ROUNDUP_JSON_SCHEMA.properties.products.items.properties.skipIf,
          keySpecs: ROUNDUP_JSON_SCHEMA.properties.products.items.properties.keySpecs,
        },
      },
    },
  },
}

/**
 * Validates an enrichment payload against the article it's meant to extend.
 * Stricter than it looks on purpose: this writes to already-published pages,
 * so a bad pass is worse than no pass.
 */
export function validateEnrichment(payload, roundup) {
  const problems = []
  const ranks = (roundup.products ?? []).map((p) => p.rank).sort((a, b) => a - b)
  const got = (payload.products ?? []).map((p) => p.rank).sort((a, b) => a - b)

  if (got.join(',') !== ranks.join(',')) {
    problems.push(`product ranks don't match the article: expected ${ranks.join(',')}, got ${got.join(',')}`)
  }

  for (const product of payload.products ?? []) {
    if (!product.bestFor?.trim()) problems.push(`rank ${product.rank}: no "get it if"`)
    if (!product.skipIf?.trim()) problems.push(`rank ${product.rank}: no "skip it if"`)
    if (/\$|\bprice\b|\bcheap(er|est)?\b/i.test(product.keySpecs ?? '')) {
      problems.push(`rank ${product.rank}: keySpecs mentions price — those go stale and can't be verified`)
    }
  }

  const skips = (payload.products ?? []).map((p) => (p.skipIf ?? '').trim().toLowerCase()).filter(Boolean)
  if (skips.length > 1 && new Set(skips).size < skips.length) {
    problems.push('two or more picks share the same "skip it if"')
  }

  if ((payload.sources?.length ?? 0) < 3) problems.push(`expected at least 3 sources, got ${payload.sources?.length ?? 0}`)
  for (const source of payload.sources ?? []) {
    if (!/^https?:\/\//i.test(source.url ?? '')) problems.push(`source has a non-http url: ${source.url}`)
  }

  const faqs = payload.faqs ?? []
  if (faqs.length < 3) problems.push(`expected at least 3 FAQs, got ${faqs.length}`)
  for (const faq of faqs) {
    if ((faq.answer ?? '').split(/\s+/).length < 15) problems.push(`FAQ answer too thin: "${faq.question}"`)
  }

  if (problems.length) throw new Error(`Enrichment failed validation:\n  - ${problems.join('\n  - ')}`)
  return payload
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
    if (!product.bestFor?.trim()) problems.push(`product ${product.rank} has no "get it if"`)
    if (!product.skipIf?.trim()) problems.push(`product ${product.rank} has no "skip it if"`)
  }

  // A "skip it if" that's the same on every product is a tell that the model
  // padded the field instead of finding a real drawback for each pick.
  const skips = products.map((p) => (p.skipIf ?? '').trim().toLowerCase()).filter(Boolean)
  if (skips.length > 1 && new Set(skips).size < skips.length) {
    problems.push('two or more products share the same "skip it if" — they should be genuinely different')
  }

  if (!draft.sources?.length) problems.push('no sources returned — content is ungrounded')

  // Sources are what back the site's "we rely on published testing" claim, so
  // a single throwaway link isn't enough to stand it up.
  if ((draft.sources?.length ?? 0) < 3) {
    problems.push(`expected at least 3 sources, got ${draft.sources?.length ?? 0}`)
  }
  for (const source of draft.sources ?? []) {
    if (!/^https?:\/\//i.test(source.url ?? '')) problems.push(`source has a non-http url: ${source.url}`)
  }

  const faqs = draft.faqs ?? []
  if (faqs.length < 3) problems.push(`expected at least 3 FAQs, got ${faqs.length}`)
  for (const faq of faqs) {
    if ((faq.answer ?? '').split(/\s+/).length < 15) problems.push(`FAQ answer too thin: "${faq.question}"`)
  }

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
        ...(product.keySpecs ? {keySpecs: product.keySpecs} : {}),
        ...(product.bestFor ? {bestFor: product.bestFor} : {}),
        ...(product.skipIf ? {skipIf: product.skipIf} : {}),
        // Placeholder until an affiliate program is connected (CLAUDE.md task 4).
        affiliateUrl: '#',
        isEditorsPick: Boolean(product.isEditorsPick),
      })),
    buyingTips: draft.buyingTips,
    pullQuote: draft.pullQuote,
    // These used to be collected, validated, and then silently dropped here —
    // every roundup was researched against real sources that the reader never
    // got to see, which made "we rely on published testing" an unverifiable
    // claim. They now reach the document and render as the article's
    // "what we read" list.
    sources: (draft.sources ?? []).map((source, index) => ({
      _type: 'source',
      _key: `source${index}`,
      title: source.title,
      url: source.url,
    })),
    faqs: (draft.faqs ?? []).map((faq, index) => ({
      _type: 'faq',
      _key: `faq${index}`,
      question: faq.question,
      answer: faq.answer,
    })),
  }
}
