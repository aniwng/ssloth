import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemas'

// projectId comes from `npx sanity init` — see ../README.md step 1.
const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

if (!projectId) {
  throw new Error(
    'SANITY_STUDIO_PROJECT_ID is not set. Copy ../.env.example to ../.env and fill it in, ' +
      'or run `npx sanity init` in this directory to create a project.',
  )
}

export default defineConfig({
  name: 'shopping-sloth',
  title: 'Shopping Sloth',
  projectId,
  dataset,
  plugins: [structureTool(), visionTool()],
  schema: {types: schemaTypes},
})
