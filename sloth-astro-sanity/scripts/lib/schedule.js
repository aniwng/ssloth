import {readFile, writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

// The content calendar is the single source of truth for the topic queue.
// The script reads it here rather than keeping its own topics array — one
// place to edit, one place to see what's shipped.
export const SCHEDULE_PATH = fileURLToPath(new URL('../../../content-schedule.csv', import.meta.url))

export const COLUMNS = [
  'week',
  'publish_date',
  'topic',
  'category',
  'slug',
  'review_mode',
  'status',
  'notes',
]

/** Statuses the pipeline understands. Idea -> Drafting -> Review -> Scheduled -> Published. */
export const STATUSES = ['Idea', 'Drafting', 'Review', 'Scheduled', 'Published']

export async function readSchedule() {
  const raw = await readFile(SCHEDULE_PATH, 'utf8')
  const lines = raw.trim().split(/\r?\n/)
  const header = splitCsvLine(lines[0])
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line)
    const row = {__line: index}
    header.forEach((key, i) => {
      row[key] = cells[i] ?? ''
    })
    return row
  })
}

export async function writeSchedule(rows) {
  const body = rows
    .map((row) => COLUMNS.map((key) => escapeCsv(row[key] ?? '')).join(','))
    .join('\n')
  await writeFile(SCHEDULE_PATH, `${COLUMNS.join(',')}\n${body}\n`, 'utf8')
}

/**
 * The next roundup to draft: the earliest row still in Idea or Drafting.
 * Rows already in Review / Scheduled / Published are left alone so a rerun
 * never clobbers something a human is looking at.
 */
export function nextTopic(rows, {slug} = {}) {
  if (slug) return rows.find((row) => row.slug === slug) ?? null
  return (
    rows
      .filter((row) => row.status === 'Idea' || row.status === 'Drafting')
      .sort((a, b) => a.publish_date.localeCompare(b.publish_date))[0] ?? null
  )
}

/** Rows marked `auto` may publish without a human in the loop. Everything else can't. */
export function isAutoPublishable(row) {
  return row.review_mode === 'auto'
}

function splitCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function escapeCsv(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
