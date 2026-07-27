# Architecture

```
  content-schedule.csv          (topic queue + review policy, repo root)
          │
          ▼
  scripts/generate-and-publish.js
          │  Claude API — structured JSON output, web search for grounding
          ▼
  Sanity  ─── roundup documents (drafts.* until a human publishes)
          │
          ▼
  astro/src/pages/[slug].astro  ── one template, every roundup
          │
          ▼
  static build → Vercel / Netlify
```

## The three pieces

| Directory  | What it is | Run it |
|---|---|---|
| `astro/`   | The public site. Static build, no server. | `npm run dev` |
| `sanity/`  | The Studio and the content schema. | `npm run dev` |
| `scripts/` | The automation entrypoint. | `npm run generate` |

Each has its own `package.json` and installs independently.

## Content model

One document type: `roundup` (`sanity/schemas/roundup.js`). Title, slug,
category, publish/update dates, reading time, rich-text intro, hero image, five
ranked products (rank, name, subtitle, blurb, image, affiliate URL, editor's
pick flag), buying tips, closing pull quote.

**Add fields here first**, then thread them through `astro/src/pages/[slug].astro`
and `scripts/lib/roundupSchema.js`. Never bolt a field on in the frontend.

## Rendering

`astro/src/pages/[slug].astro` is the only article template. `getStaticPaths()`
enumerates every roundup at build time, so a new Sanity document becomes a new
page on the next build with no new files. Same for `category/[category].astro`.

Data access goes through `astro/src/lib/roundups.js`, which reads Sanity when
`PUBLIC_SANITY_PROJECT_ID` is set and otherwise falls back to
`astro/src/lib/seed/roundups.json`. The fallback exists so a fresh clone builds;
it is not part of the content model.

Design tokens live once in `astro/src/styles/style.css` under `:root`, copied
verbatim from the static prototype. The slow transition timing
(`--dur-slow` / `--ease-slow`) is a brand decision, not an oversight.

## Generation

`scripts/generate-and-publish.js` orchestrates:

- `lib/schedule.js` — read/advance `content-schedule.csv`
- `lib/prompt.js` — brand voice, editorial rules, the paraphrase-never-copy constraint
- `lib/roundupSchema.js` — the JSON schema the API enforces, plus the checks it
  can't express (exactly 5 products, ranks 1–5, exactly one editor's pick), plus
  the JSON → Sanity document transform
- `lib/claude.js` — the API call: `claude-opus-5`, structured outputs, the
  `web_search` server tool, `pause_turn` resumption, refusal handling
- `lib/sanityWrite.js` — token-authenticated write client

The model is never asked for affiliate URLs, images, or prices — it can't know
them. Those are filled in downstream.
