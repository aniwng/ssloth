import {defineArrayMember, defineField, defineType} from 'sanity'

export const CATEGORIES = ['health', 'tech', 'home', 'accessories']

/**
 * The roundup document — the only content type on the site.
 *
 * This schema is the contract between three things: the Sanity Studio, the
 * Astro template that renders it, and the JSON the generate script asks Claude
 * for. Add a field here FIRST, then thread it through the other two. Never
 * bolt a field on in the frontend.
 */
export default defineType({
  name: 'roundup',
  title: 'Roundup',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'e.g. "Top 5 Sunscreens for Your Body in 2026"',
      validation: (Rule) => Rule.required().max(90),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 72},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {list: CATEGORIES.map((value) => ({title: value, value}))},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated at',
      type: 'datetime',
      description: 'Drives the "updated jul 2026" line. Bump on any refresh.',
    }),
    defineField({
      name: 'readingMinutes',
      title: 'Reading time (minutes)',
      type: 'number',
      validation: (Rule) => Rule.min(1).max(30),
    }),
    defineField({
      name: 'intro',
      title: 'Intro',
      type: 'array',
      of: [defineArrayMember({type: 'block', styles: [{title: 'Normal', value: 'normal'}]})],
      description: 'Two short paragraphs, sloth voice. Paraphrase sources — never copy.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero image',
      type: 'image',
      options: {hotspot: true},
      fields: [defineField({name: 'alt', title: 'Alt text', type: 'string'})],
      description: 'Optional. Leave empty and the template renders the placeholder tile.',
    }),
    defineField({
      name: 'ranked',
      title: 'Ranked roundup?',
      type: 'boolean',
      initialValue: true,
      description:
        'On (default): a numbered top-5 with an editor\'s pick and per-item buy buttons — for named, ' +
        'ranked products. Off: an unnumbered list of items with no editor\'s pick or buy button — for ' +
        'articles about product *categories* or general picks rather than one winning item (e.g. ' +
        '"popular things people buy during tax-free weekend"). Both modes reuse the same `products` ' +
        'array below; toggling this only changes how [slug].astro renders it.',
    }),
    defineField({
      name: 'products',
      title: 'Products',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'product',
          fields: [
            defineField({
              name: 'rank',
              title: 'Order',
              type: 'number',
              description: 'Display order. Only shown as a numbered rank when "Ranked roundup?" is on.',
              validation: (R) => R.required().min(1),
            }),
            defineField({name: 'name', title: 'Product name', type: 'string', validation: (R) => R.required()}),
            defineField({
              name: 'subtitle',
              title: 'Superlative',
              type: 'string',
              description: 'e.g. "best overall body sunscreen"',
              validation: (R) => R.required().max(60),
            }),
            defineField({
              name: 'blurb',
              title: 'Blurb',
              type: 'text',
              rows: 4,
              description: 'Two to three sentences. Paraphrased, never quoted.',
              validation: (R) => R.required(),
            }),
            defineField({
              name: 'examples',
              title: 'Popular picks',
              type: 'string',
              description:
                'Optional, unranked roundups only. A few comma-separated example products for this ' +
                'category (e.g. "sneakers, jeans, lightweight jackets"). Rendered as a "popular picks" ' +
                'line under the blurb. Ignored in ranked roundups.',
            }),
            defineField({
              name: 'image',
              title: 'Product image',
              type: 'image',
              options: {hotspot: true},
              fields: [defineField({name: 'alt', title: 'Alt text', type: 'string'})],
            }),
            defineField({
              name: 'affiliateUrl',
              title: 'Affiliate URL',
              type: 'url',
              description: 'Placeholder "#" until an affiliate program is connected. Unranked roundups skip this.',
            }),
            defineField({
              name: 'relatedUrl',
              title: 'Related article link (internal)',
              type: 'string',
              description:
                'Optional, unranked roundups only. A site-relative path (e.g. "/top-5-backpacks-for-' +
                'back-to-school-in-2026/") to a full roundup covering this category — rendered as a small ' +
                'link under the blurb. Leave empty if there is no matching roundup yet.',
            }),
            defineField({
              name: 'relatedLabel',
              title: 'Related article link text',
              type: 'string',
              description: 'Link text for relatedUrl, e.g. "See our full backpack roundup". Required if relatedUrl is set.',
            }),
            defineField({
              name: 'isEditorsPick',
              title: "Editor's pick",
              type: 'boolean',
              initialValue: false,
              description: 'Ignored when "Ranked roundup?" is off.',
            }),
          ],
          preview: {
            select: {title: 'name', subtitle: 'subtitle', rank: 'rank'},
            prepare: ({title, subtitle, rank}) => ({title: `${rank}. ${title}`, subtitle}),
          },
        }),
      ],
      description: 'Exactly 5 for a ranked roundup. Any count for an unranked guide.',
      validation: (Rule) => Rule.required().min(1).max(10),
    }),
    defineField({
      name: 'stateDates',
      title: 'State-by-state dates',
      type: 'array',
      description:
        'Optional. For guides tied to a per-state event (tax holidays, etc.) — a state name paired ' +
        'with its date range. Leave empty for ordinary product roundups.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'stateDate',
          fields: [
            defineField({name: 'state', title: 'State', type: 'string', validation: (R) => R.required()}),
            defineField({
              name: 'dates',
              title: 'Dates',
              type: 'string',
              description: 'e.g. "Aug 7–9"',
              validation: (R) => R.required(),
            }),
            defineField({
              name: 'rate',
              title: 'Sales tax rate',
              type: 'string',
              description: 'State-level sales tax rate shoppers skip during the holiday, e.g. "6%". Optional.',
            }),
            defineField({
              name: 'note',
              title: 'Note',
              type: 'string',
              description: 'Optional short aside, e.g. "longest window of any state".',
            }),
          ],
          preview: {
            select: {title: 'state', subtitle: 'dates'},
          },
        }),
      ],
    }),
    defineField({
      name: 'buyingTips',
      title: 'Quick buying tips',
      type: 'text',
      rows: 4,
      description: 'One short paragraph rendered in the tips box.',
    }),
    defineField({
      name: 'pullQuote',
      title: 'Closing pull quote',
      type: 'string',
      description: 'The dry sloth aside at the bottom of the article.',
    }),
  ],
  orderings: [
    {
      title: 'Newest first',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
  ],
  preview: {
    select: {title: 'title', subtitle: 'category', media: 'heroImage'},
  },
})
