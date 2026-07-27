# Shopping Sloth

Affiliate content site publishing "top 5" product roundups. Slow picks, fast results.

Astro (static site) + Sanity (headless CMS) + a Node script that drafts roundups
with the Claude API and writes them into Sanity for review.

**Read [CLAUDE.md](CLAUDE.md) first** — it's the orienting document for what's
been decided and why. This file is just how to run things.

## Requirements

Node **18.20.8+** (Astro 5 needs it; 22 recommended). Check with `node -v`.

## Layout

```
shopping-sloth/
├── CLAUDE.md                    # decisions, conventions, next tasks — read this
├── HANDOFF.md                   # narrative recap of the project so far
├── content-schedule.csv         # 8-week topic queue; the script reads and updates it
├── static-prototype/            # original hand-coded design reference (frozen)
└── sloth-astro-sanity/
    ├── .env.example             # copy to .env
    ├── astro/                   # the site
    ├── sanity/                  # the Studio + content schema
    └── scripts/                 # generate-and-publish.js
```

## Run the site right now

The site builds without any credentials — with no Sanity project configured it
falls back to the seed roundup in `astro/src/lib/seed/roundups.json`, so you can
see the design working before standing up the CMS.

```bash
cd sloth-astro-sanity/astro
npm install
npm run dev
```

## Connect Sanity

1. Create the project and get a project ID:

   ```bash
   cd sloth-astro-sanity/sanity
   npm install
   npx sanity init --env .env      # writes SANITY_STUDIO_PROJECT_ID
   ```

2. Fill in the env files (two of them — the Studio can only read its own):

   ```bash
   cd sloth-astro-sanity
   cp .env.example .env            # PUBLIC_SANITY_PROJECT_ID, SANITY_WRITE_TOKEN, ANTHROPIC_API_KEY
   cp sanity/.env.example sanity/.env
   ```

   The write token comes from [sanity.io/manage](https://sanity.io/manage) → API →
   Tokens, with **Editor** permissions.

3. Deploy the schema and open the Studio:

   ```bash
   cd sloth-astro-sanity/sanity
   npm run deploy-schema
   npm run dev                     # http://localhost:3333
   ```

Once `PUBLIC_SANITY_PROJECT_ID` is set, the Astro site reads from Sanity and
never touches the seed file again.

## Generate a roundup

```bash
cd sloth-astro-sanity/scripts
npm install
npm run queue                      # what's next in the calendar
npm run generate:dry               # draft it, print it, write nothing
npm run generate                   # draft it and write a Sanity draft for review
```

The script takes the next `Idea`/`Drafting` row from `content-schedule.csv`,
asks Claude for JSON matching the `roundup` schema (grounded with web search),
validates it, writes it to Sanity as a **draft**, and moves the calendar row to
`Review`.

Nothing publishes itself. `--publish` works only on rows marked `auto` in the
calendar; rows marked `human-reviewed` always stop at draft. The scheduled
GitHub Action (`.github/workflows/generate-roundup.yml`) never passes
`--publish` at all — every automated draft waits for a human.

What Claude does **not** produce: affiliate links (placeholder `#`), product
images, or prices. Those are open decisions — see CLAUDE.md tasks 4 and 5.

## Deploy

Not set up yet. The Astro app is a plain static build (`npm run build` →
`astro/dist/`), so Vercel or Netlify with root directory `sloth-astro-sanity/astro`
should just work. Add a Sanity webhook to trigger a rebuild on publish.
