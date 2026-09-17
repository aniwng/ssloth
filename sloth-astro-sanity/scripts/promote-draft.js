#!/usr/bin/env node
/**
 * Promote a Sanity draft (_id: "drafts.roundup.<slug>") to published
 * (_id: "roundup.<slug>") — the same effect as hitting "Publish" in Studio,
 * done from the CLI. Reads the draft's current content straight from
 * Sanity (not from a local JSON file), writes it under the published id,
 * then deletes the draft.
 *
 * Before writing anything, checks every product's affiliateUrl (see
 * lib/affiliateLinks.js) and refuses to publish if one is confirmed dead —
 * a 404'd or delisted ASIN going live is worse than a late roundup.
 *
 *   PUBLIC_SANITY_PROJECT_ID=... SANITY_WRITE_TOKEN=... node promote-draft.js <slug>
 *   node promote-draft.js <slug> --dry-run   # print what would happen, write nothing
 *   node promote-draft.js <slug> --force     # publish anyway despite a broken link
 */
import {createClient} from '@sanity/client'
import 'dotenv/config'
import {checkRoundup, formatReport, hasBroken} from './lib/affiliateLinks.js'

const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')
const slug = process.argv[2]

async function main() {
  if (!slug || slug.startsWith('--')) {
    throw new Error('Usage: node promote-draft.js <slug> [--dry-run]')
  }

  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID
  const token = process.env.SANITY_WRITE_TOKEN
  if (!projectId) throw new Error('PUBLIC_SANITY_PROJECT_ID is not set')
  if (!token) throw new Error('SANITY_WRITE_TOKEN is not set — create an Editor token in sanity.io/manage')

  const client = createClient({
    projectId,
    dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
    apiVersion: process.env.PUBLIC_SANITY_API_VERSION || '2024-01-01',
    token,
    useCdn: false,
  })

  const draftId = `drafts.roundup.${slug}`
  const publishedId = `roundup.${slug}`

  const draft = await client.getDocument(draftId)
  if (!draft) throw new Error(`No draft found at ${draftId}`)

  console.log(`\n${draft.title}`)
  console.log(`  ${draftId} -> ${publishedId}`)

  console.log('\nChecking affiliate links...')
  const linkReport = await checkRoundup(draft)
  console.log(formatReport(linkReport))

  if (hasBroken(linkReport) && !force) {
    throw new Error('One or more affiliate links are broken — fix them in Studio, or rerun with --force to publish anyway.')
  }

  if (dryRun) {
    console.log('\nDry run complete — nothing written.')
    return
  }

  const {_id, _rev, ...rest} = draft
  await client.createOrReplace({...rest, _id: publishedId})
  await client.delete(draftId)

  console.log('\nPublished. Live on the next deploy.')
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
