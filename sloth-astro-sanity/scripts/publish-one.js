#!/usr/bin/env node
/**
 * Push a single article from astro/src/lib/seed/roundups.json into Sanity,
 * by slug. Unlike migrate-seed.js (which re-writes every seed article), this
 * only touches the one requested — safe to run repeatedly for new articles
 * without re-uploading hero images that are already in Sanity.
 *
 *   PUBLIC_SANITY_PROJECT_ID=... SANITY_WRITE_TOKEN=... node publish-one.js <slug>
 *   node publish-one.js <slug> --dry-run   # print what would be written, upload nothing
 */
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {createClient} from '@sanity/client'
import 'dotenv/config'

const dryRun = process.argv.includes('--dry-run')
const slug = process.argv[2]

async function main() {
  if (!slug || slug.startsWith('--')) {
    throw new Error('Usage: node publish-one.js <slug> [--dry-run]')
  }

  const seedPath = fileURLToPath(new URL('../astro/src/lib/seed/roundups.json', import.meta.url))
  const roundups = JSON.parse(await readFile(seedPath, 'utf8'))
  const roundup = roundups.find((r) => r.slug === slug)
  if (!roundup) throw new Error(`No article with slug "${slug}" in seed/roundups.json`)

  let client = null
  if (!dryRun) {
    const projectId = process.env.PUBLIC_SANITY_PROJECT_ID
    const token = process.env.SANITY_WRITE_TOKEN
    if (!projectId) throw new Error('PUBLIC_SANITY_PROJECT_ID is not set')
    if (!token) throw new Error('SANITY_WRITE_TOKEN is not set — create an Editor token in sanity.io/manage')
    client = createClient({
      projectId,
      dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
      apiVersion: process.env.PUBLIC_SANITY_API_VERSION || '2024-01-01',
      token,
      useCdn: false,
    })
  }

  console.log(`\n${roundup.title}`)

  let heroImage
  if (roundup.heroImage) {
    if (dryRun) {
      console.log(`  would upload hero: ${roundup.heroImage}`)
    } else {
      heroImage = await uploadPublicImage(client, roundup.heroImage)
      console.log(`  uploaded hero -> ${heroImage.asset._ref}`)
    }
  }

  const doc = {
    _id: `roundup.${roundup.slug}`,
    _type: 'roundup',
    title: roundup.title,
    slug: {_type: 'slug', current: roundup.slug},
    category: roundup.category,
    publishedAt: roundup.publishedAt,
    updatedAt: roundup.updatedAt,
    readingMinutes: roundup.readingMinutes,
    intro: roundup.intro,
    ...(heroImage ? {heroImage} : {}),
    ranked: roundup.ranked ?? true,
    products: roundup.products.map((product, i) => ({
      _type: 'product',
      _key: `product${i}`,
      rank: product.rank,
      name: product.name,
      subtitle: product.subtitle,
      blurb: product.blurb,
      ...(product.examples ? {examples: product.examples} : {}),
      ...(product.affiliateUrl ? {affiliateUrl: product.affiliateUrl} : {}),
      isEditorsPick: Boolean(product.isEditorsPick),
      ...(product.relatedLinks?.length
        ? {
            relatedLinks: product.relatedLinks.map((link, j) => ({
              _type: 'relatedLink',
              _key: `related${i}-${j}`,
              url: link.url,
              label: link.label,
            })),
          }
        : {}),
    })),
    ...(roundup.stateDates?.length
      ? {
          stateDates: roundup.stateDates.map((row, i) => ({
            _type: 'stateDate',
            _key: `state${i}`,
            state: row.state,
            dates: row.dates,
            ...(row.rate ? {rate: row.rate} : {}),
            ...(row.note ? {note: row.note} : {}),
          })),
        }
      : {}),
    buyingTips: roundup.buyingTips,
    pullQuote: roundup.pullQuote,
  }

  if (dryRun) {
    console.log(`  would write _id: ${doc._id}`)
    console.log('\nDry run complete — nothing written.')
    return
  }

  await client.createOrReplace(doc)
  console.log(`  written: ${doc._id}`)
  console.log('\nDone.')
}

/** Uploads a file from astro/public (e.g. "/images/foo.jpg") as a Sanity image asset. */
async function uploadPublicImage(client, publicPath) {
  const filePath = fileURLToPath(new URL(`../astro/public${publicPath}`, import.meta.url))
  const buffer = await readFile(filePath)
  const asset = await client.assets.upload('image', buffer, {filename: publicPath.split('/').pop()})
  return {_type: 'image', asset: {_type: 'reference', _ref: asset._id}}
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
