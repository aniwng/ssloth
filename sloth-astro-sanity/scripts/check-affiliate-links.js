#!/usr/bin/env node
/**
 * Pre-publish check: for a roundup's products, fetch each affiliateUrl and
 * confirm it's still a live, purchasable Amazon listing that actually
 * matches the product it's attached to. See lib/affiliateLinks.js for the
 * checking logic — this is also what promote-draft.js and publish-due.js
 * run automatically before publishing.
 *
 *   node check-affiliate-links.js <slug>        # one draft or published roundup
 *   node check-affiliate-links.js --due          # every currently-due draft
 *   node check-affiliate-links.js <slug> --json  # machine-readable report
 *
 * Exit code is 1 only if a link is confirmed BROKEN (dead ASIN, delisted,
 * redirected to search). NAME_MISMATCH / UNVERIFIED are reported but don't
 * fail the run — string-matching a product title is a heuristic, not proof.
 */
import {createClient} from '@sanity/client'
import 'dotenv/config'
import {checkRoundup, formatReport, hasBroken} from './lib/affiliateLinks.js'

const asJson = process.argv.includes('--json')
const checkDue = process.argv.includes('--due')
const slugArg = process.argv.slice(2).find((a) => !a.startsWith('--'))

async function main() {
  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID
  const token = process.env.SANITY_WRITE_TOKEN
  if (!projectId) throw new Error('PUBLIC_SANITY_PROJECT_ID is not set')
  if (!token) throw new Error('SANITY_WRITE_TOKEN is not set')

  const client = createClient({
    projectId,
    dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
    apiVersion: process.env.PUBLIC_SANITY_API_VERSION || '2024-01-01',
    token,
    useCdn: false,
  })

  let docs
  if (checkDue) {
    docs = await client.fetch(
      `*[_type == "roundup" && _id in path("drafts.**") && publishedAt <= now()]`,
    )
  } else if (slugArg) {
    const draft = await client.getDocument(`drafts.roundup.${slugArg}`)
    const published = await client.getDocument(`roundup.${slugArg}`)
    const doc = draft || published
    if (!doc) throw new Error(`No draft or published roundup found for slug "${slugArg}"`)
    docs = [doc]
  } else {
    throw new Error('Usage: node check-affiliate-links.js <slug> | --due [--json]')
  }

  const reports = []
  let anyBroken = false
  for (const doc of docs) {
    const report = await checkRoundup(doc)
    reports.push(report)
    if (hasBroken(report)) anyBroken = true
    if (!asJson) console.log(formatReport(report))
  }

  if (asJson) {
    console.log(JSON.stringify(reports, null, 2))
  } else {
    const flat = reports.flatMap((r) => r.results)
    const brokenCount = flat.filter((r) => r.status === 'BROKEN').length
    const mismatchCount = flat.filter((r) => r.status === 'NAME_MISMATCH').length
    console.log(`\n${brokenCount} broken, ${mismatchCount} possible mismatch — review those in Studio before publishing.`)
  }

  if (anyBroken) process.exitCode = 1
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
