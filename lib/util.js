/**
 * Small shared helpers: stable ids, time parsing, CSV, hashing.
 */
import { createHash } from 'node:crypto'

/* ------------------------------------------------------------- stable ids */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
function base32(buf, length) {
  let out = ''; let bits = 0; let value = 0
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xffff
    bits += 8
    while (bits >= 5 && out.length < length) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
    if (out.length >= length) break
  }
  return out
}
/** `<prefix>-<12 base32 chars of sha256(parts)>`: content-derived, survives re-runs. */
export function stableId(prefix, ...parts) {
  return `${prefix}-${base32(createHash('sha256').update(parts.map(String).join('\u001f')).digest(), 12)}`
}
export const sha256 = (s) => createHash('sha256').update(s).digest('hex')
/** Small stable integer hash (FNV-1a) for bucketing. */
export function fnv(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

/* ------------------------------------------------------------------- time */

export const pad = (n, w = 2) => String(n).padStart(w, '0')

/**
 * Parse an export timestamp into local `YYYY-MM-DD HH:mm` (UTC+8 by default):
 * epoch millis (number or digit string ≥ 12 digits), `2016-04-18 08:14:00`,
 * `2016-04-18T08:14`, `20160418081400`, `20160418`, `2016/4/18 8:14`, `2016年4月18日`.
 */
export function parseInstant(raw, { utcOffsetMinutes = 480 } = {}) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s || s.toLowerCase() === 'null') return null
  if (/^\d{13}$/.test(s) || /^\d{10}$/.test(s)) {
    const ms = s.length === 10 ? Number(s) * 1000 : Number(s)
    const d = new Date(ms + utcOffsetMinutes * 60000)
    if (Number.isNaN(d.getTime())) return null
    return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
  let m = s.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?$/)
  if (!m) m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T]+(\d{1,2})[:时](\d{1,2})(?:[:分](\d{1,2}))?)?/)
  if (!m) return null
  const [y, mo, d, hh = '0', mm = '0'] = m.slice(1).map((x) => x ?? undefined)
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null
  return `${pad(+y, 4)}-${pad(+mo)}-${pad(+d)} ${pad(+hh)}:${pad(+mm)}`
}
export const dayOf = (instant) => (instant ? String(instant).slice(0, 10) : null)

const DAY = 86400000
const toEpochDay = (day) => { const [y, m, d] = day.slice(0, 10).split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1) / DAY }
export function addMonthsDay(day, n) {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12); const nm = total - ny * 12 + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${pad(ny, 4)}-${pad(nm)}-${pad(Math.min(d, last))}`
}
export function addDaysDay(day, n) {
  const dt = new Date((toEpochDay(day) + n) * DAY)
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}
export const diffDays = (a, b) => toEpochDay(b) - toEpochDay(a)
/** Whole years between two days (`YYYY[-MM[-DD]]`). */
export function yearsBetween(a, b) {
  const [ya, ma = 1, da = 1] = a.split('-').map(Number)
  const [yb, mb = 1, db = 1] = b.split('-').map(Number)
  let y = yb - ya
  if (mb < ma || (mb === ma && db < da)) y--
  return y
}
export function monthsBetween(a, b) {
  return Math.round((diffDays(fullDay(a), fullDay(b)) / 30.4375) * 10) / 10
}
/** `YYYY` / `YYYY-MM` → first day; full days pass through. */
export const fullDay = (d) => (d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d.slice(0, 10))

/* -------------------------------------------------------------------- csv */

export function csvCell(v) {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const csvLine = (cells) => `${cells.map(csvCell).join(',')}\n`

/** Minimal RFC-4180 parser (quoted fields, embedded newlines). Returns array of rows. */
export function parseCsv(text, delimiter = ',') {
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c
    } else if (c === '"') q = true
    else if (c === delimiter) { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

/* ------------------------------------------------------------------- misc */

export const present = (v) => v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null'

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }
export function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}
/** Normalise document text once; every offset refers to the result. */
export const normText = (s) => decodeEntities(String(s ?? '').replace(/\r\n?/g, '\n'))

/** Run async `fn` over items with at most `width` in flight. */
export async function pool(items, width, fn, isCancelled = () => false) {
  const out = new Array(items.length); let next = 0
  await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length)) }, async () => {
    while (next < items.length && !isCancelled()) { const i = next++; out[i] = await fn(items[i], i) }
  }))
  return out
}
