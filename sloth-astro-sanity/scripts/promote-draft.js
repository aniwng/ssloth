#!/usr/bin/env node
/**
 * Promote a Sanity draft (_id: "drafts.roundup.<slug>") to published
 * (_id: "roundup.<slug>") — the same effect as hitting "Publish" in Studio,
 * done from the CLI. Reads the draft's current content straight from
 * Sanity (not from a local JSON file), writes it under the published id,
 * then deletes the draft.
 *
 *   PUBLIC_SANITY_PROJECT_ID=... SANITY_WRITE_TOKEN=... node promote-draft.js <slug>
 *   node promote-draft.js <slug> --dry-run   # print what would happen, write nothing
 */
import {createClient} from '@sanity/client'
import 'dotenv/config'

const dryRun = process.argv.includes('--dry-run')
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
