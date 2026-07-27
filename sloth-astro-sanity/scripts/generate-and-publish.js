#!/usr/bin/env node
/**
 * Draft the next roundup from the content calendar and write it into Sanity.
 *
 * Intended to run on a schedule (GitHub Action / cron) on the cadence in
 * content-schedule.csv. Manual Studio editing is the exception — fixing an
 * error — not the normal workflow.
 *
 *   node generate-and-publish.js                 # next queued topic -> Sanity draft
 *   node generate-and-publish.js --dry-run       # draft it, print it, write nothing
 *   node generate-and-publish.js --slug some-slug
 *   node generate-and-publish.js --publish       # only allowed for review_mode=auto rows
 *   node generate-and-publish.js --list          # show the queue
 *
 * The human review checkpoint is deliberate: rows marked `human-reviewed` in
 * the calendar can never be auto-published, even with --publish. Don't remove
 * that without the site owner's explicit sign-off.
 */
import {fileURLToPath} from 'node:url'
import {writeFile} from 'node:fs/promises'
import 'dotenv/config'

import {draftRoundup} from './lib/claude.js'
import {validateRoundup, toSanityDocument} from './lib/roundupSchema.js'
import {readSchedule, writeSchedule, nextTopic, isAutoPublishable} from './lib/schedule.js'
import {upsertRoundup, studioUrl} from './lib/sanityWrite.js'

const args = parseArgs(process.argv.slice(2))

async function main() {
  const rows = await readSchedule()

  if (args.list) {
    for (const row of rows) {
      console.log(
        `${row.publish_date}  ${row.status.padEnd(9)}  ${row.review_mode.padEnd(14)}  ${row.topic}`,
      )
    }
    return
  }

  const row = nextTopic(rows, {slug: args.slug})
  if (!row) {
    console.log(args.slug ? `No calendar row with slug "${args.slug}".` : 'Nothing left in the queue.')
    process.exitCode = args.slug ? 1 : 0
    return
  }

  const publish = args.publish && isAutoPublishable(row)
  if (args.publish && !publish) {
    console.log(`"${row.topic}" is marked ${row.review_mode} — writing a draft for review instead.`)
  }

  console.log(`Drafting: ${row.topic} (${row.category}, publishes ${row.publish_date})`)

  const {draft, usage, model} = await draftRoundup({
    topic: row.topic,
    category: row.category,
    slug: row.slug,
  })
  validateRoundup(draft)

  console.log(`  ${model} · ${usage.input_tokens} in / ${usage.output_tokens} out`)
  console.log(`  sources: ${draft.sources.map((s) => s.title).join(', ')}`)

  const doc = toSanityDocument(draft, {row, publish})

  if (args.dryRun) {
    const out = fileURLToPath(new URL(`./out/${row.slug}.json`, import.meta.url))
    await writeFile(out, JSON.stringify({doc, sources: draft.sources}, null, 2))
    console.log(`\nDry run — nothing written to Sanity. Draft saved to ${out}`)
    return
  }

  await upsertRoundup(doc)

  row.status = publish ? 'Published' : 'Review'
  await writeSchedule(rows)

  console.log(publish ? `\nPublished: ${doc.slug.current}` : `\nDraft ready for review: ${studioUrl(doc)}`)
  console.log(`Calendar row moved to "${row.status}".`)
}

function parseArgs(argv) {
  const out = {dryRun: false, publish: false, list: false, slug: null}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--publish') out.publish = true
    else if (arg === '--list') out.list = true
    else if (arg === '--slug') out.slug = argv[++i]
    else if (arg.startsWith('--slug=')) out.slug = arg.slice('--slug='.length)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return out
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
