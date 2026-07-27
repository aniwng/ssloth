# Shopping Sloth — Handoff Summary

A narrative recap of everything decided and built so far, for whoever
picks this project up next (including future-you).

---

## The Concept

An affiliate blog reviewing "top 5" products in categories like beauty,
tech, home, and outdoor gear. The angle: most affiliate listicle sites
feel rushed and low-trust, so this one leans into being deliberately
*slow and thorough* — reading actual reviews, comparing testing data
across sources, and only recommending things worth recommending. That
premise became the brand itself.

## Brand

- **Name:** Shopping Sloth
- **Tagline:** "Slow picks. Fast results."
- **Voice:** dry, a little self-aware, understated humor. Never
  oversells a product. Leans on phrases like "we hung around on it a
  while" and "no rush, just really good picks."
- **Logo/mascot:** attempted three times (illustrated, minimal, refined
  silhouette) — none successfully read as "sloth" to the user. This was
  set aside rather than resolved. **The site currently uses a generic
  paw-print icon as a placeholder**, and brand personality is instead
  carried through color, typography, copy voice, and a deliberately
  slow motion/transition style on interactive elements (buttons ease in
  slower than a typical site would — a small wink at the "slow" bit).
  If you want another crack at the mascot, it's worth trying a different
  tool or getting an actual illustrator involved rather than more
  SVG-from-scratch attempts.

## Content

- Wrote a full example article: **"Top 5 Sunscreens for Your Body in
  2026"** — researched from real review sources (Consumer Reports, CNN
  Underscored, Treeline Review, NBC Select, CNET), paraphrased rather
  than quoted, with an affiliate disclosure and placeholder buy links.
- Wrote the **About page** copy, fully in the sloth voice, including an
  affiliate disclosure section.
- Built an **8-week content calendar** (spreadsheet) rotating through 16
  topic ideas across the four categories, publishing twice weekly
  (Tuesday/Friday), with a status pipeline (Idea → Drafting → Review →
  Scheduled → Published) and deliberate human-review checkpoints rather
  than fully unsupervised publishing.

## Design

- Explored several name and mascot directions before landing on
  Shopping Sloth + the paw-print/slow-motion approach described above.
- Built a full **visual mockup pass** first (homepage, article page with
  an "editor's pick" treatment, mobile layout) before writing real code,
  to nail the layout and hierarchy decisions early.
- Then built an actual **static HTML/CSS prototype** — homepage, one
  full article, about page, shared stylesheet — using a custom palette
  (deep canopy green, warm sand, gold accent) deliberately chosen to
  avoid the generic "cream + terracotta" look that's become an AI-design
  cliché, paired with Fraunces (serif, characterful headlines) and
  Nunito Sans (friendly body text).

## Technical Direction

- Discussed CMS options broadly (WordPress, Webflow, headless CMS) and
  landed on **Astro (static site generator) + Sanity (headless CMS)** as
  the best fit — it preserves the custom-coded design while still
  supporting scripted, automated publishing via API, which a themed
  WordPress or visual-builder tool wouldn't do as cleanly.
- Sketched (not built) the target production architecture: a Sanity
  content schema for roundup posts, one reusable Astro template that
  renders any roundup by slug, and a Node script intended to run on a
  schedule that would draft content (via the Claude API) and push it
  into Sanity automatically.
- Discussed specifically what the **Claude API's job** would be in that
  pipeline: drafting structured JSON content matching the schema,
  optionally grounding it with web search for current review data, and
  writing in the established brand voice — while being explicit about
  what it *can't* do (source real product images, generate affiliate
  links, verify live pricing/stock).

## What's Real vs. What's a Sketch

**Real and usable right now:**
- The static HTML/CSS prototype (can be opened in a browser today)
- The article and about-page copy
- The content calendar spreadsheet

**Structural sketches, not yet functional:**
- The Astro/Sanity scaffold — no real Sanity project exists, no Astro
  project has been initialized, no API keys are connected
- The automation script — has a placeholder where the real Claude API
  call needs to go
- No affiliate program is connected yet (all links are placeholders)
- No deployment/hosting is set up

## Recommended Next Step

Hand this to Claude Code (or a developer) with `CLAUDE.md` as the
orienting document — it lists the concrete next tasks in priority order,
starting with standing up a real Sanity project and initializing the
actual Astro app around the existing static design.
