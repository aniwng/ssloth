import {createClient} from '@sanity/client'

let cached = null

export function getWriteClient() {
  if (cached) return cached

  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID
  const token = process.env.SANITY_WRITE_TOKEN

  if (!projectId) throw new Error('PUBLIC_SANITY_PROJECT_ID is not set — see .env.example')
  if (!token) throw new Error('SANITY_WRITE_TOKEN is not set — create an Editor token in sanity.io/manage')

  cached = createClient({
    projectId,
    dataset: process.env.PUBLIC_SANITY_DATASET || 'production',
    apiVersion: process.env.PUBLIC_SANITY_API_VERSION || '2024-01-01',
    token,
    useCdn: false, // writes must never hit the CDN
  })
  return cached
}

/** Creates or replaces the document. Draft ids keep it out of the live site. */
export async function upsertRoundup(doc) {
  return getWriteClient().createOrReplace(doc)
}

export function studioUrl(doc) {
  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID
  const id = doc._id.replace(/^drafts\./, '')
  return `https://${projectId}.sanity.studio/structure/roundup;${id}`
}
