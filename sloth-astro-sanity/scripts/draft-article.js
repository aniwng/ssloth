#!/usr/bin/env node
/**
 * Push a single article as a Sanity DRAFT (_id: "drafts.roundup.<slug>").
 * Unlike publish-one.js, this never goes live — draft docs are invisible to
 * the site because sanityClient.js pins perspective: 'published'. The draft
 * shows up in Sanity Studio for review; publishing it for real (in Studio,
 * or by re-running publish-one.js once approved) is a separate step.
 *
 * Takes a path to a JSON file with the same shape as one entry in
 * astro/src/lib/seed/roundups.json. Article content lives wherever the
 * caller puts that file — this script doesn't touch seed/roundups.json.
 *
 *   PUBLIC_SANITY_PROJECT_ID=... SANITY_WRITE_TOKEN=... node draft-article.js <path-to-article.json>
 *   node draft-article.js <path> --dry-run   # print what would be written, upload nothing
 */
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createClient} from '@sanity/client'
import 'dotenv/config'

const dryRun = process.argv.includes('--dry-run')
const articlePath = process.argv[2]

async function main() {
  if (!articlePath || articlePath.startsWith('--')) {
    throw new Error('Usage: node draft-article.js <path-to-article.json> [--dry-run]')
  }

  const roundup = JSON.parse(await readFile(path.resolve(articlePath), 'utf8'))

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

  console.log(`\n${roundup.title} (draft)`)

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
    _id: `drafts.roundup.${roundup.slug}`,
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
    showRankNumbers: roundup.showRankNumbers ?? true,
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
  console.log(`  written as draft: ${doc._id}`)
  console.log('\nDone. Review in Sanity Studio; not visible on the live site until published.')
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
