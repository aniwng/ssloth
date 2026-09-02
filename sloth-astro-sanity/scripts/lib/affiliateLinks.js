/**
 * Pre-publish affiliate link check: confirms a product's Amazon URL still
 * resolves to a live, purchasable listing that's plausibly the product it's
 * attached to — not a 404, a delisted ASIN redirected to search results, or
 * a link that's quietly started pointing at something else.
 *
 * Heuristic, not proof: NAME_MISMATCH and UNVERIFIED (e.g. Amazon served a
 * robot check instead of the page) are reported but never treated as a hard
 * failure — only a confirmed-BROKEN link blocks anything.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const STOPWORDS = new Set([
  'with', 'for', 'and', 'the', 'a', 'an', 'of', 'in', 'on', 'to', 'inch', 'inches',
  'pack', 'quart', 'qt', 'set', 'best', 'this', 'that',
])

function significantWords(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w),
  )
}

function overlapRatio(name, pageTitle) {
  const nameWords = new Set(significantWords(name))
  const titleWords = new Set(significantWords(pageTitle))
  if (nameWords.size === 0) return 0
  let hits = 0
  for (const w of nameWords) if (titleWords.has(w)) hits++
  return hits / nameWords.size
}

export async function checkUrl(url) {
  if (!url) return {status: 'NO_URL'}
  if (!/amazon\.[a-z.]+\/.*\b(dp|gp\/product)\/[A-Z0-9]{10}/i.test(url)) {
    return {status: 'UNVERIFIED', note: 'not a recognizable Amazon /dp/ URL, skipped'}
  }

  let res
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: {'User-Agent': UA, Accept: 'text/html'},
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    return {status: 'UNVERIFIED', note: `fetch failed: ${err.message}`}
  }

  const finalUrl = res.url
  if (/\/s\?/.test(finalUrl) || /\/gp\/search/.test(finalUrl)) {
    return {status: 'BROKEN', note: `redirected to a search page (${finalUrl}) — ASIN likely delisted`}
  }

  if (res.status === 404) return {status: 'BROKEN', note: 'HTTP 404'}
  if (!res.ok) return {status: 'UNVERIFIED', note: `HTTP ${res.status}`}

  const html = await res.text()

  if (/dogs-of-amazon|Sorry! We couldn't find that page|Page Not Found/i.test(html)) {
    return {status: 'BROKEN', note: "Amazon's 404 page"}
  }

  const titleMatch = html.match(/id="productTitle"[^>]*>([^<]+)</)
  if (!titleMatch) {
    return {status: 'UNVERIFIED', note: 'no productTitle found (likely a bot check page)'}
  }
  const pageTitle = titleMatch[1].trim().replace(/&amp;/g, '&')

  const unavailable = /id="availability"[\s\S]{0,200}?Currently unavailable/i.test(html)
  if (unavailable) {
    return {status: 'BROKEN', note: 'listing exists but is "Currently unavailable"', pageTitle}
  }

  return {status: 'OK', pageTitle}
}

export async function checkProduct(product) {
  const result = await checkUrl(product.affiliateUrl)
  if (result.status === 'OK' && result.pageTitle) {
    const ratio = overlapRatio(product.name, result.pageTitle)
    if (ratio < 0.4) {
      return {...result, status: 'NAME_MISMATCH', ratio: Math.round(ratio * 100)}
    }
  }
  return result
}

/** Checks every product on a roundup doc. Returns {slug, title, results[]}. */
export async function checkRoundup(doc) {
  const results = []
  for (const product of doc.products || []) {
    const result = await checkProduct(product)
    results.push({name: product.name, url: product.affiliateUrl, ...result})
  }
  return {slug: doc.slug?.current, title: doc.title, results}
}

export function formatReport(report) {
  const lines = [`\n${report.title}  (${report.slug})`]
  const badge = {
    OK: '  ok  ',
    NO_URL: ' none ',
    BROKEN: 'BROKEN',
    NAME_MISMATCH: ' name?',
    UNVERIFIED: '  ??  ',
  }
  for (const r of report.results) {
    lines.push(`  [${badge[r.status]}] ${r.name}`)
    if (r.status === 'NAME_MISMATCH') {
      lines.push(`           link title: "${r.pageTitle}" (${r.ratio}% word overlap)`)
    } else if (r.note) {
      lines.push(`           ${r.note}`)
    }
  }
  return lines.join('\n')
}

export function hasBroken(report) {
  return report.results.some((r) => r.status === 'BROKEN')
}
