# CLAUDE.md — Shopping Sloth

This file orients Claude Code (or any future contributor) to this project:
what it is, what's been decided, what exists right now, and what's left to
build. Read this before making structural changes.

---

## Project Overview

**Shopping Sloth** is an affiliate content site that publishes "top 5"
product roundup articles (sunscreens, earbuds, fans, etc.), monetized via
affiliate links. The differentiating angle: a "slow but deliberate" brand
voice — the site takes its time to actually read reviews and compare
products, rather than publishing rushed, low-effort listicles.

- **Tagline:** "Slow picks. Fast results."
- **Brand voice:** dry, a little self-aware, never oversells. Leans into
  the sloth bit in copy ("we hung around on it a while"), not just imagery.
- **Monetization:** affiliate links (Amazon Associates and/or other
  programs — not yet finalized which).

---

## Current State

### What exists and works
- A hand-coded **static prototype** in `static-prototype/`: homepage, one
  full article (sunscreens), and an about page. It is no longer frozen — it
  is the **design workbench**, because it renders with no build step and the
  Astro app currently can't run on this machine's Node. Its `style.css` is
  kept byte-identical to `astro/src/styles/style.css`; when you change one,
  copy it to the other.
- A real **Astro project** (`sloth-astro-sanity/astro/`) built around that
  design: base layout, homepage, about page, category pages, and the single
  dynamic roundup template. `npm install && npm run dev` runs it today —
  with no Sanity project configured it falls back to the seed roundup in
  `astro/src/lib/seed/roundups.json` (the sunscreen article, in schema shape).
- A real **Sanity schema and Studio config** (`sloth-astro-sanity/sanity/`).
  The schema is written and ready to deploy; it needs a project ID.
- A working **generate script** (`sloth-astro-sanity/scripts/`): a real Claude
  API call using structured JSON output against the `roundup` schema, the
  `web_search` server tool for grounding, validation, and a Sanity write.
  It reads its topic queue from `content-schedule.csv`.
- A **content schedule** (`content-schedule.csv`) — 8 weeks, twice weekly,
  with a per-row `review_mode` that decides whether a post may ever
  auto-publish.
- A **GitHub Action** (`.github/workflows/generate-roundup.yml`) on the
  Tuesday/Friday cadence. It always produces drafts, never publishes.

### What does NOT exist yet
- No real Sanity project — no project ID, no deployed schema, no documents.
  Everything downstream of that is written but unexercised.
- **Nothing has been run.** The scaffold was authored on a machine with
  Node 12; no `npm install`, no build, no API call has actually executed.
  Expect to shake out dependency-version and typo-level issues on first run.
- No deployment (no Vercel/Netlify project connected)
- No logo / mascot illustration — **abandoned as out of scope for now**,
  see Decisions Deferred below
- No affiliate program accounts connected (all links are `#` placeholders)
- No product images — the schema and template support them, but image
  sourcing is still undecided, so everything renders the placeholder tile

---

## Architecture Decisions

### Decision: Headless CMS + static site generator, not WordPress/Webflow
**Chosen:** Astro (static site generator) + Sanity (headless CMS)
**Why:** The custom hand-coded design (specific color palette, typography,
component classes) needs to survive automated publishing. A headless CMS
keeps content as structured data (title, products, blurbs) completely
separate from presentation (the Astro template + existing CSS), so an
automation script can create new posts via API without touching HTML.
**Rejected:** WordPress (would require rebuilding the design as a PHP
theme; more plugin overhead for something this custom) and Webflow (less
control over hand-written HTML/CSS; the CMS collections model doesn't map
as cleanly to Claude-generated content as an API-first tool would).

### Decision: One dynamic template per content type, not one file per article
`astro/src/pages/[slug].astro` renders every roundup from a single
template by querying Sanity per-slug at build time. New Sanity documents
become new pages automatically — **no new `.html`/`.astro` file should
ever be hand-written per article** going forward. If a future contributor
finds themselves creating `article-2.astro`, that's a sign the pattern
has been broken and should be fixed, not extended.

### Decision: Content schema lives in Sanity, not hardcoded in components
See `sanity/schemas/roundup.js`. Every roundup has: title, slug, category,
intro (rich text), heroImage, and an array of ranked products (rank, name,
subtitle, blurb, image, affiliateUrl, isEditorsPick). **Any new field a
roundup needs (e.g. a "price" field) should be added to this schema
first**, then threaded through the Astro template — not bolted on ad hoc
in the frontend.

### Decision: Publishing pipeline is script → CMS → rebuild, not manual CMS editing
`scripts/generate-and-publish.js` is meant to run on a schedule (cron or
GitHub Actions) and write directly into Sanity via its write API. The
intent is minimal-to-no manual dashboard editing for routine posts — manual
editing should be the exception (fixing an error), not the normal workflow.

### Decision: Modern editorial theme (replaces the original canopy palette)
**Chosen:** off-white paper, near-black ink, one warm clay accent
(`#B8705F`) used sparingly; Fraunces display over Inter body; hairline
rules and whitespace instead of cards, shadows, and filled blocks.
**Why:** the site targets women shoppers, and the brief was a more stylish,
minimal, modern feel. The original deep-green / sand / gold palette read
warm and outdoorsy rather than editorial.
**Superseded:** the earlier palette (`--canopy`, `--sand`, `--gold`,
`--bark`) and Nunito Sans body type. Those tokens no longer exist — if you
find a reference to one, it's stale.
**Scope:** re-skin only. The name, the dry sloth voice, the paw mark, and
the slow motion timing all carry over unchanged. The original palette's
stated goal — avoiding the generic cream-and-terracotta AI look — still
applies, and is why the clay accent is rationed to small elements rather
than used as a background wash.

### Decision: Logo mark resolved — full-color sloth illustration
Supersedes the earlier "no mascot" deferral below. The user supplied a
finished multi-color sloth-peeking-over-a-bag illustration (source: a
2048×2048 SVG with the "shopping sloth" wordmark baked in as vector letter
paths). It was cropped to icon-only — the wordmark paths were removed
since the site already sets "shopping sloth" in its own Fraunces type next
to the mark — and saved as `sloth-mark.svg` in both
`static-prototype/sloth-mark.svg` and
`sloth-astro-sanity/astro/public/sloth-mark.svg` (kept identical, same as
the two `style.css` copies).

**Scope decision:** this full-color mark replaces the icon in the primary
brand lockup only — `.brand` (header) and `.footer-brand` (footer), via
`<img src="sloth-mark.svg" class="brand-mark">` — plus the favicon. It
does **not** replace the small single-color paw-print glyph
(`PawIcon.astro` / the inline paw SVG in the static prototype) used for
tiny accents: badges ("sloth approved"), the hero eyebrow pill, section
heads, and the "editor's pick" flag. A detailed multicolor illustration
shrunk to 11px reads as mud; the simple paw dot still works at that size.
If a future contributor is tempted to swap those too, don't — it's a
deliberate two-tier system (one detailed brand mark, one tiny accent
glyph), not an inconsistency to "fix."

**A separate rebrand to "Weighed Goods"/"Weighted Goods" (abstract
balance-scale mark, premium editorial voice) was proposed and then
explicitly rejected by the user in the same conversation.** The project
name, voice, and this sloth mark are the settled direction — don't
resurrect the balance-scale concept without the user raising it again.

### Decision (superseded, kept for history): No mascot/logo yet
Multiple early logo attempts (illustrated sloth, minimal silhouette) did
not read clearly as "sloth" to the user, so the site ran on a generic
paw-print placeholder for a while. Resolved above — the user later
supplied a finished mark that did work.

### Decision: Article hero/card images use licensed stock photography; per-product photos are hidden, not stock
Two different interim answers to task 5 (image sourcing), for two
different kinds of image on the page:

- **Article-level images** (`.article-hero` on the article page, `.card-img`
  on homepage/category cards — both driven by the roundup's single
  `heroImage` field) use a **licensed stock photo per article** as an
  interim step. The current example article uses a Pexels photo (Pexels
  License — free for commercial use, no attribution required) of a hand
  applying sunscreen to a leg. This is legitimate here because the image
  is illustrating the *topic* (sunscreen, generally), not standing in for
  any specific named product.
- **Per-product photos** (`.entry-thumb`, one per ranked product) are
  **hidden entirely** (`display: none` in `style.css`) rather than using
  stock photography. A generic stock photo of "a sunscreen bottle" would
  misrepresent which of the 5 ranked products it's showing — that's not
  an honest interim step the way an article-level thematic photo is.
  These stay hidden until real per-product photos are sourced (task 5,
  still open: Amazon PA-API, affiliate asset libraries, or brand press
  kits).

**Choosing a stock photo, if you add hero images for future articles:**
avoid photos where legible text (a sign, a card, lettering) is the main
subject — they crop unpredictably across the very different aspect
ratios of `.article-hero` (wide, shallow) and `.card-img` (4:3), and
important content can end up cut off in one or the other. Prefer
images where the subject is centered and evenly distributed. Also avoid
a legible competing brand/logo in frame, and avoid identifiable people
where the photo could read as depicting a specific product's user.

**How to bring per-product photos back**, once sourced: in
`static-prototype/style.css`, restore `.entry`'s `grid-template-columns`
to `auto 84px minmax(0, 1fr) auto` (and the mobile override to
`auto 60px minmax(0, 1fr)`), restore `.entry-copy`'s `grid-column` to
`3 / -1`, and remove `.entry-thumb`'s `display: none` — each spot has a
comment marking it. Do the same in `sloth-astro-sanity/astro/src/styles/style.css`
(kept byte-identical to the prototype's) and drop the `ph` class
convention already wired up in `[slug].astro`'s `.entry-thumb` div once
real photos exist (see how `.article-hero` and `.card-img` do this
conditionally, keyed off whether the image field is populated).

### Decision: Unranked "guide" format for content that isn't a top-5 of named products
Some topics don't fit "5 named products, ranked, with a winner" — the first
case was a tax-free-weekend shopping guide, which is really a list of
*categories* worth buying plus a state-by-state date table, not 5 competing
products. Rather than building a second content type/schema/template, the
existing `roundup` schema gained two optional fields:

- **`ranked`** (boolean, default `true`) — when `false`, `[slug].astro`
  renders the `products` array as a plain `.list`/`.list-item` (name,
  subtitle, blurb) with no rank number, no editor's-pick flag, no per-item
  buy button, and skips the affiliate disclosure paragraph. The `products`
  array is reused either way — only the rendering branches.
- **`stateDates`** (array of `{state, dates, note?}`) — optional, renders as
  a `.state-dates` table after the products section. Leave empty for
  ordinary roundups.

**Why this shape and not a new content type:** it reuses ~90% of the
existing fields (title, intro, heroImage, buyingTips, pullQuote) and the
single-template rule — see "One dynamic template per content type" above.
The `products.rank` field's title was changed from "Rank" to "Order" to
reflect that it's a display-order field in both modes, not just a ranking.

**First example:** `tax-free-weekend-2026-what-to-buy-and-when`
in `astro/src/lib/seed/roundups.json`, and
`static-prototype/article-tax-free-weekend.html`.

**Known gap:** the automated generation pipeline
(`scripts/lib/prompt.js`, `scripts/lib/roundupSchema.js`) has **not** been
updated to know about `ranked`/`stateDates` — it still only asks Claude for
the classic 5-ranked-product shape. This unranked format is currently
hand-authored only. If the generation script should ever produce this
content type unattended, `roundupSchema.js`'s JSON schema and validation
and `prompt.js`'s instructions need to be extended first.

---

## Repo / File Structure

```
shopping-sloth/
├── CLAUDE.md                          # this file
├── HANDOFF.md                         # narrative recap of the project so far
├── README.md                          # how to run everything
├── content-schedule.csv               # 8-week topic queue — the script's
│                                       # source of truth, and it writes back
├── .github/workflows/
│   └── generate-roundup.yml           # Tue/Fri scheduled draft run
│
├── static-prototype/                  # hand-coded design reference (FROZEN)
│   ├── index.html                     # homepage
│   ├── article-sunscreens.html        # one full example article
│   ├── about.html                     # about page
│   └── style.css                      # shared styles — canonical source
│                                       # of truth for colors/type/spacing
│
└── sloth-astro-sanity/                # the production app
    ├── README.md                      # architecture diagram
    ├── .env.example                   # Astro + scripts config
    ├── sanity/
    │   ├── .env.example               # Studio config (separate on purpose)
    │   ├── sanity.config.js           # Studio
    │   └── schemas/roundup.js         # content schema — extend here FIRST
    ├── astro/
    │   ├── astro.config.mjs
    │   └── src/
    │       ├── styles/style.css       # copied from the prototype + additions
    │       ├── lib/
    │       │   ├── sanityClient.js    # client + image URL builder
    │       │   ├── roundups.js        # data access (Sanity, or seed fallback)
    │       │   └── seed/roundups.json # the sunscreen article, in schema shape
    │       ├── components/            # PawIcon, ProductImage, RoundupCard
    │       ├── layouts/BaseLayout.astro
    │       └── pages/
    │           ├── index.astro
    │           ├── about.astro
    │           ├── [slug].astro       # single dynamic article template
    │           └── category/[category].astro
    └── scripts/
        ├── generate-and-publish.js    # automation entrypoint
        └── lib/
            ├── schedule.js            # read/advance the CSV queue
            ├── prompt.js              # brand voice + editorial rules
            ├── roundupSchema.js       # JSON schema, validation, Sanity transform
            ├── claude.js              # the Claude API call
            └── sanityWrite.js         # write client
```

**Design tokens** (colors, fonts, spacing, motion) are defined once in
`style.css` under `:root`. Any new template or page must reuse these
variables rather than introducing new hardcoded colors.

- `--paper` / `--paper-raised` / `--paper-sunk` — off-white surfaces
- `--ink` / `--ink-soft` / `--muted` — near-black text ramp
- `--accent` / `--accent-deep` / `--accent-tint` — warm clay, used
  **sparingly**: primary CTAs, the editor's pick, small labels. Never as a
  large field — that restraint is what keeps it from reading as the
  cream-and-terracotta cliché the brand set out to avoid.
- `--line` / `--line-strong` — hairlines, which do the work that borders
  and boxes used to
- `--step--2` … `--step-5` — type scale; `--label-size` / `--label-track`
  for the uppercase micro-labels that carry the editorial look
- `--ph-a` / `--ph-b` / `--ph-glow` / `--ph-ink` — per-category placeholder
  tints, set by the `.cat-*` classes
- `--ease-slow` / `--dur-slow` — intentionally slow transition timing,
  a deliberate brand touch (the "slow" joke expressed through motion
  since the mascot illustration didn't land) — **keep this**, don't
  "fix" it to a faster default transition speed.

Fonts: **Fraunces** (display/headlines) + **Inter** (body), loaded from
Google Fonts in `style.css`. Requires internet access to render correctly —
if self-hosting fonts becomes necessary, keep the same two typefaces.

---

## Next Tasks (in rough priority order)

0. **Get onto Node 18+.** The scaffold was written on a machine running
   Node 12, which Astro 5 refuses to run on. Install Node 22 (nvm, Homebrew,
   or the installer from nodejs.org) before anything below.
1. **Install and run everything once.** `npm install` in `astro/`, `sanity/`,
   and `scripts/`, then `npm run dev` in `astro/`. None of this code has
   executed yet — assume there are first-run issues to fix.
2. **Stand up the real Sanity project** — `npx sanity init` in `sanity/`,
   fill in both `.env` files, `npm run deploy-schema`. Once
   `PUBLIC_SANITY_PROJECT_ID` is set the site stops using the seed fallback.
3. **Do a real generate run** — `npm run generate:dry` in `scripts/` to see
   Claude's output without writing, then `npm run generate` to land a draft
   in Sanity. Tune `lib/prompt.js` if the voice is off.
4. **Decide on and connect an affiliate program** (Amazon Associates
   most likely) — needed before any `affiliateUrl` fields can be real.
   The generate script currently hardcodes `#`.
5. **Decide on product image sourcing** — Amazon PA-API, affiliate asset
   libraries, or brand press kits (do NOT scrape random web images —
   copyright risk, covered in earlier conversation). Still open for
   per-product photos specifically — see the interim decision below for
   what's already in place for hero/card images.
6. **Deployment: settled on GitHub Pages**, not Vercel/Netlify. Domain is
   `https://shoppingsloth.com` — set as the default in `astro.config.mjs`'s
   `site` field (drives canonical URLs) and as the custom domain via
   `astro/public/CNAME`. `.github/workflows/deploy.yml` builds on every push
   to `main` and publishes via `actions/deploy-pages`. Still needed: push
   this repo to GitHub, then enable Pages in repo Settings → Pages → Source:
   GitHub Actions, and add `shoppingsloth.com`'s DNS records (CNAME to
   `<owner>.github.io`, or A records for an apex domain — see GitHub's docs)
   pointing at GitHub Pages.
   The Sanity project ID is `364itju4`, but it has **zero documents** in its
   `production` dataset — `PUBLIC_SANITY_PROJECT_ID` is deliberately left
   unset in the deploy workflow so the build keeps using the seed content
   instead of shipping an empty site. Once content is migrated into Sanity
   (task 2), add `PUBLIC_SANITY_PROJECT_ID` back as a step env var (or repo
   variable) in `deploy.yml`.
7. **Turn on the scheduled trigger** — `.github/workflows/generate-roundup.yml`
   exists and runs Tuesdays and Fridays. It needs the three repo secrets
   (`ANTHROPIC_API_KEY`, `PUBLIC_SANITY_PROJECT_ID`, `SANITY_WRITE_TOKEN`)
   before it will do anything.
8. **(Optional, deferred) Revisit mascot/logo** — only if the user
   raises it again; don't proactively re-attempt.

---

## Working Conventions

- **Paraphrase, never copy** source review content when generating
  article copy — copyright constraint, discussed explicitly earlier.
- **Affiliate disclosure** must appear on every page that includes
  affiliate links (already present in the static prototype's footer —
  preserve this in the Astro layout).
- **Don't hand-author new article HTML files.** All new roundups go
  through Sanity + the shared template, per the architecture decision above.
- **Human review checkpoint stays in the loop** — `content-schedule.csv`
  marks each row `human-reviewed` or `auto`. The script refuses to publish a
  `human-reviewed` row even when passed `--publish`, and the scheduled
  GitHub Action never passes `--publish` at all. Don't loosen either without
  the user's explicit sign-off.
- **`content-schedule.csv` is the single topic queue.** The script reads its
  next topic from there and writes the row's status back. Don't reintroduce a
  separate topics array in the script.
- **The seed content is a dev fallback, not content.** `astro/src/lib/seed/`
  exists so a fresh clone builds before Sanity is connected. Don't add
  articles there — they go in Sanity.
- **Keep the two stylesheets in sync.** `static-prototype/style.css` and
  `astro/src/styles/style.css` are the same file in two places. The
  prototype is the only way to eyeball CSS without a working Astro build, so
  edit there, check it in a browser, then copy across.
