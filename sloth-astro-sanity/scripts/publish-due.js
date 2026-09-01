#!/usr/bin/env node
/**
 * Promote every draft roundup whose publishedAt has arrived — the same
 * effect as running promote-draft.js for each due slug. Intended to run on
 * a schedule (see .github/workflows/publish-scheduled.yml) so September's
 * (and beyond) queued drafts go live on their planned dates without a human
 * clicking "Publish" in Studio.
 *
 *   PUBLIC_SANITY_PROJECT_ID=... SANITY_WRITE_TOKEN=... node publish-due.js
 *   node publish-due.js --dry-run   # print what would be published, write nothing
 */
import {createClient} from '@sanity/client'
import 'dotenv/config'
import {appendFileSync} from 'node:fs'

const dryRun = process.argv.includes('--dry-run')

async function main() {
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

  const due = await client.fetch(
    `*[_type == "roundup" && _id in path("drafts.**") && publishedAt <= now()] | order(publishedAt asc)`,
  )

  if (due.length === 0) {
    console.log('Nothing due — no drafts with publishedAt in the past.')
    setOutput('published', 'false')
    return
  }

  const publishedSlugs = []

  for (const draft of due) {
    const slug = draft.slug?.current
    const publishedId = `roundup.${slug}`

    console.log(`\n${draft.title}`)
    console.log(`  ${draft._id} -> ${publishedId}  (was due ${draft.publishedAt})`)

    if (dryRun) continue

    const {_id, _rev, ...rest} = draft
    await client.createOrReplace({...rest, _id: publishedId})
    await client.delete(draft._id)
    publishedSlugs.push(slug)
  }

  if (dryRun) {
    console.log('\nDry run complete — nothing written.')
    setOutput('published', 'false')
    return
  }

  console.log(`\nPublished ${publishedSlugs.length} roundup(s): ${publishedSlugs.join(', ')}`)
  setOutput('published', 'true')
  setOutput('slugs', publishedSlugs.join(', '))
}

/** No-op outside GitHub Actions (GITHUB_OUTPUT unset). */
function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
