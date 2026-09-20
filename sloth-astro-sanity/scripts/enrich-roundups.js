#!/usr/bin/env node
/**
 * Backfills the supporting fields on already-published roundups.
 *
 * Why this exists
 * ---------------
 * The site tells readers, on every article, that it doesn't test products and
 * instead relies on published reviews and testing. Until now there was nothing
 * on the page backing that up: the generator researched sources for every
 * draft, validated them, and then dropped them before writing to Sanity (fixed
 * in lib/roundupSchema.js). Articles also had no FAQs and no per-product "get
 * it if / skip it if", so a pick's only downside was whatever the blurb chose
 * to admit.
 *
 * Every roundup published before those schema changes is missing all of it.
 * This script walks the published documents, asks Claude to research the
 * missing supporting detail for each, and patches it in.
 *
 * What it deliberately does NOT do
 * --------------------------------
 * Touch the picks, the ranks, the blurbs, the intro, or the title. Those have
 * been reviewed by a person and are live at a URL someone may have linked. The
 * enrichment is additive; if you want an article rewritten, rewrite it.
 *
 *   node enrich-roundups.js                  # dry run — prints, writes nothing
 *   node enrich-roundups.js --write          # patch drafts for human review
 *   node enrich-roundups.js --write --publish  # patch the live documents
 *   node enrich-roundups.js --slug best-e-readers-in-2026 --write
 *   node enrich-roundups.js --limit 5 --write
 *   node enrich-roundups.js --all --write    # re-run on articles already done
 */
import 'dotenv/config'

import {enrichRoundup} from './lib/claude.js'
import {validateEnrichment} from './lib/roundupSchema.js'
import {getWriteClient, studioUrl} from './lib/sanityWrite.js'

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const valueOf = (flag) => {
  const i = args.indexOf(flag)
  return i === -1 ? null : args[i + 1]
}

const WRITE = has('--write')
const PUBLISH = has('--publish')
const REDO = has('--all')
const ONLY_SLUG = valueOf('--slug')
const LIMIT = Number(valueOf('--limit') || 0)

const QUERY = `*[_type == "roundup" && defined(slug.current)] | order(publishedAt asc) {
  _id, title, category, "slug": slug.current, sources, faqs,
  products[]{rank, name, subtitle, blurb, bestFor, skipIf, keySpecs}
}`

/** An article still needs a pass if any of the supporting fields is missing. */
function needsEnrichment(roundup) {
  if (!roundup.sources?.length) return true
  if (!roundup.faqs?.length) return true
  return (roundup.products ?? []).some((p) => !p.bestFor || !p.skipIf)
}

async function main() {
  const client = getWriteClient()
  // 'published' so we enrich what readers actually see, not a stale draft
  // sitting next to it.
  const all = await client.withConfig({perspective: 'published'}).fetch(QUERY)

  let queue = all.filter((r) => (REDO ? true : needsEnrichment(r)))
  if (ONLY_SLUG) queue = queue.filter((r) => r.slug === ONLY_SLUG)
  if (LIMIT > 0) queue = queue.slice(0, LIMIT)

  if (queue.length === 0) {
    console.log(`Nothing to do — ${all.length} roundup(s) checked, all already enriched.`)
    return
  }

  console.log(`${queue.length} of ${all.length} roundup(s) need enrichment.`)
  if (!WRITE) console.log('Dry run — pass --write to actually patch. Nothing will be saved.\n')
  else console.log(PUBLISH ? 'Patching LIVE documents.\n' : 'Patching drafts for review.\n')

  const failures = []

  for (const [index, roundup] of queue.entries()) {
    console.log(`[${index + 1}/${queue.length}] ${roundup.slug}`)

    try {
      const {draft: payload, usage} = await enrichRoundup(roundup)
      validateEnrichment(payload, roundup)

      const byRank = new Map(payload.products.map((p) => [p.rank, p]))
      const patch = {
        sources: payload.sources.map((source, i) => ({
          _type: 'source',
          _key: `source${i}`,
          title: source.title,
          url: source.url,
        })),
        faqs: payload.faqs.map((faq, i) => ({
          _type: 'faq',
          _key: `faq${i}`,
          question: faq.question,
          answer: faq.answer,
        })),
        // Rebuilt from the EXISTING products, with only the new fields merged
        // in — never from the model's copy of them, so a hallucinated product
        // name can't overwrite a real one.
        products: roundup.products.map((product) => {
          const extra = byRank.get(product.rank) ?? {}
          return {
            ...product,
            _type: 'product',
            _key: `product${product.rank}`,
            bestFor: extra.bestFor,
            skipIf: extra.skipIf,
            ...(extra.keySpecs ? {keySpecs: extra.keySpecs} : {}),
          }
        }),
      }

      console.log(`      ${patch.sources.length} sources, ${patch.faqs.length} FAQs`)
      for (const product of patch.products) {
        console.log(`      ${product.rank}. ${product.name}`)
        console.log(`         get it if:  ${product.bestFor}`)
        console.log(`         skip it if: ${product.skipIf}`)
        if (product.keySpecs) console.log(`         specs:      ${product.keySpecs}`)
      }
      if (usage) console.log(`      tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`)

      if (WRITE) {
        // Bumping updatedAt is honest here: the page genuinely gained content.
        const targetId = PUBLISH ? roundup._id : `drafts.${roundup._id.replace(/^drafts\./, '')}`

        if (PUBLISH) {
          await client.patch(targetId).set({...patch, updatedAt: new Date().toISOString()}).commit()
        } else {
          // createOrReplace rather than patch: a draft may not exist yet, and
          // patching a missing document fails.
          await client.createOrReplace({
            ...(await client.withConfig({perspective: 'published'}).getDocument(roundup._id)),
            _id: targetId,
            ...patch,
            updatedAt: new Date().toISOString(),
          })
        }
        console.log(`      saved → ${studioUrl({_id: targetId})}`)
      }
    } catch (error) {
      console.error(`      FAILED: ${error.message}`)
      failures.push({slug: roundup.slug, error: error.message})
    }

    console.log('')
  }

  if (failures.length) {
    console.error(`${failures.length} roundup(s) failed:`)
    for (const failure of failures) console.error(`  - ${failure.slug}: ${failure.error}`)
    process.exitCode = 1
  } else {
    console.log(`Done. ${queue.length} roundup(s) processed.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
