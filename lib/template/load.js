/**
 * 抽取模板：校验（docs/template.md §8）与编译（召回、规则、选项变成正则）。
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sha256 } from '../util.js'

export const FORMAT = 'extract-template/1'
export const TYPES = ['presence', 'enum', 'number', 'score', 'date', 'text', 'list', 'derived']
export const GRANULARITIES = ['document', 'encounter', 'patient', 'timepoint']
export const ASSERTIONS = ['阳性', '否认', '可疑', '既往', '家族', '计划']
export const PICKS = ['any', 'first', 'last', 'max', 'min', 'earliest', 'latest', 'all', 'mode']
export const DERIVE_OPS = ['ageAt', 'monthsBetween', 'reduction', 'threshold', 'anyOf', 'countOf']
const DEFAULT_PICK = { presence: 'any', enum: 'mode', number: 'last', score: 'last', date: 'earliest', text: 'all', list: 'all', derived: 'last' }
const PICK_OK = {
  presence: ['any', 'first', 'last'], enum: ['mode', 'first', 'last', 'all'], number: ['first', 'last', 'max', 'min', 'all'],
  score: ['first', 'last', 'max', 'min', 'all'], date: ['earliest', 'latest', 'first', 'last', 'all'], text: ['all', 'first', 'last'],
  list: ['all', 'first', 'last'], derived: ['last', 'first', 'all'],
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function tryRe(src, flags, problems, where) {
  try { return new RegExp(src, flags) } catch (e) { problems.push(`${where}：正则不能编译（${e.message}）`); return null }
}
/** One regex from literal terms + regex sources. Terms are matched case-insensitively. */
function alternation(terms = [], regexes = []) {
  // named groups belong to rules; in a combined recall pattern they would clash
  const parts = [...terms.filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRe), ...regexes.filter(Boolean).map((r) => `(?:${r.replace(/\(\?<([A-Za-z_]\w*)>/g, '(?:')})`)]
  return parts.length ? parts.join('|') : null
}

export function validateTemplate(t) {
  const problems = []
  if (!t || typeof t !== 'object') return ['模板不是 JSON 对象']
  if (t.format !== FORMAT) problems.push(`format 应为 ${FORMAT}`)
  if (!/^[a-z][a-z0-9-]*$/.test(t.id ?? '')) problems.push('id 应为小写字母开头的 [a-z0-9-]')
  for (const k of ['name', 'version', 'description']) if (!t[k]) problems.push(`缺少 ${k}`)
  if (t.references != null && (!Array.isArray(t.references) || t.references.some((r) => !r?.title))) problems.push('references 应为 [{title, url?}]')
  if (!Array.isArray(t.fields) || !t.fields.length) { problems.push('fields 为空'); return problems }
  const ids = new Set(); const byId = new Map()
  for (const [i, f] of t.fields.entries()) {
    const at = `字段 ${f?.id ?? `#${i + 1}`}`
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(f?.id ?? '')) problems.push(`${at}：id 不合法`)
    if (ids.has(f.id)) problems.push(`${at}：id 重复`)
    ids.add(f.id); byId.set(f.id, f)
    if (!f.name) problems.push(`${at}：缺少 name`)
    if (!TYPES.includes(f.type)) { problems.push(`${at}：type 应为 ${TYPES.join('/')}`); continue }
    if (!f.definition) problems.push(`${at}：缺少 definition`)
    if (f.granularity && !GRANULARITIES.includes(f.granularity)) problems.push(`${at}：granularity 不合法`)
    if (f.pick && !PICK_OK[f.type].includes(f.pick)) problems.push(`${at}：pick=${f.pick} 不适用于 ${f.type}`)
    if (f.accept && (!Array.isArray(f.accept) || f.accept.some((a) => !ASSERTIONS.includes(a)))) problems.push(`${at}：accept 只能是 ${ASSERTIONS.join('/')}`)
    if (f.model && !['auto', 'always', 'never'].includes(f.model)) problems.push(`${at}：model 应为 auto/always/never`)
    if (f.priority && !['P0', 'P1', 'P2'].includes(f.priority)) problems.push(`${at}：priority 应为 P0/P1/P2`)
    for (const r of f.recall?.regex ?? []) tryRe(r, 'u', problems, `${at} recall`)
    const rids = new Set()
    for (const r of f.rules ?? []) {
      if (!r.id) problems.push(`${at}：规则缺少 id`)
      if (rids.has(r.id)) problems.push(`${at}：规则 id ${r.id} 重复`)
      rids.add(r.id)
      const re = tryRe(r.regex ?? '', 'u', problems, `${at} 规则 ${r.id}`)
      if (re && r.value == null && !/\(\?<(?:v|date)>/.test(r.regex)) problems.push(`${at} 规则 ${r.id}：没有固定 value，也没有命名分组 v 或 date`)
      if (r.assertion && !ASSERTIONS.includes(r.assertion)) problems.push(`${at} 规则 ${r.id}：assertion 不合法`)
      if (r.factor != null && typeof r.factor !== 'number') problems.push(`${at} 规则 ${r.id}：factor 应为数值`)
      if (r.map != null && (typeof r.map !== 'object' || Array.isArray(r.map))) problems.push(`${at} 规则 ${r.id}：map 应为 {原文写法: 规范值}`)
    }
    if (f.type === 'enum' || (f.type === 'list' && f.options)) {
      if (!Array.isArray(f.options) || !f.options.length) problems.push(`${at}：enum 需要 options`)
      const vals = new Set()
      for (const o of f.options ?? []) {
        if (!o?.value) problems.push(`${at}：选项缺少 value`)
        if (vals.has(o.value)) problems.push(`${at}：选项 ${o.value} 重复`)
        vals.add(o.value)
        for (const r of o.regex ?? []) tryRe(r, 'u', problems, `${at} 选项 ${o.value}`)
      }
    }
    if (f.range && (typeof f.range !== 'object' || (f.range.min != null && typeof f.range.min !== 'number') || (f.range.max != null && typeof f.range.max !== 'number'))) problems.push(`${at}：range 应为 {min,max} 数值`)
    if (f.type === 'derived') {
      if (!DERIVE_OPS.includes(f.derive?.op)) problems.push(`${at}：derive.op 应为 ${DERIVE_OPS.join('/')}`)
    }
  }
  // derive references
  for (const f of t.fields) {
    if (f.type !== 'derived' || !f.derive) continue
    const at = `字段 ${f.id}`
    const refs = [f.derive.field, f.derive.from, f.derive.to, f.derive.at, ...(f.derive.fields ?? [])].filter((x) => x && !String(x).startsWith('$'))
    for (const r of refs) if (!byId.has(r)) problems.push(`${at}：derive 引用的字段 ${r} 不存在`)
    const need = { reduction: ['score'], threshold: ['number', 'score', 'derived'], countOf: ['list'], anyOf: ['presence', 'derived'], ageAt: ['date'], monthsBetween: ['date'] }[f.derive.op] ?? []
    for (const r of refs) if (byId.has(r) && need.length && !need.includes(byId.get(r).type)) problems.push(`${at}：derive.${f.derive.op} 不能用 ${byId.get(r).type} 字段 ${r}`)
    if (f.derive.op === 'threshold' && (!['>=', '<=', '>', '<', '=='].includes(f.derive.cmp ?? f.derive.op2) || typeof f.derive.value !== 'number')) problems.push(`${at}：threshold 需要 cmp 与数值 value`)
  }
  return problems
}

/** Compile a validated template into matchers. */
export function compileTemplate(t, { priorities = null } = {}) {
  const problems = validateTemplate(t)
  if (problems.length) throw Object.assign(new Error(`模板 ${t?.id ?? ''} 校验未通过：\n- ${problems.join('\n- ')}`), { code: 'template-invalid', problems })
  const keep = priorities?.length ? new Set(priorities) : null
  const fields = []
  for (const f of t.fields) {
    const priority = f.priority ?? 'P1'
    if (keep && !keep.has(priority) && f.type !== 'derived') continue
    const terms = f.recall?.terms?.length || f.recall?.regex?.length ? (f.recall.terms ?? []) : [f.name, ...(f.include ?? [])]
    const optionTerms = (f.options ?? []).flatMap((o) => [...(o.terms ?? []), ...(o.regex ?? []).map((r) => ({ re: r }))])
    const recallSrc = f.type === 'derived' ? null : alternation(
      [...terms, ...optionTerms.filter((x) => typeof x === 'string')],
      [...(f.recall?.regex ?? []), ...optionTerms.filter((x) => typeof x === 'object').map((x) => x.re), ...(f.rules ?? []).map((r) => r.regex)],
    )
    fields.push({
      ...f,
      priority,
      granularity: f.granularity ?? 'encounter',
      pick: f.pick ?? DEFAULT_PICK[f.type],
      accept: new Set(f.accept ?? ['阳性']),
      model: f.model ?? 'auto',
      recallRe: recallSrc ? new RegExp(recallSrc, 'giu') : null,
      rulesC: (f.rules ?? []).map((r) => ({ ...r, re: new RegExp(r.regex, 'gu') })),
      optionsC: (f.options ?? []).map((o) => ({ value: o.value, re: alternation(o.terms ?? [], o.regex ?? []) ? new RegExp(alternation(o.terms ?? [], o.regex ?? []), 'giu') : null })),
      recordTypes: f.sources?.recordTypes?.length ? f.sources.recordTypes : null,
      sections: f.sources?.sections?.length ? f.sources.sections : null,
      signature: sha256(JSON.stringify(f)).slice(0, 16),
    })
  }
  const docTypes = t.documents?.recordTypes?.length ? new Set(t.documents.recordTypes) : null
  const docExclude = new Set(t.documents?.excludeRecordTypes ?? [])
  return {
    id: t.id, name: t.name, version: t.version, description: t.description, groups: t.groups ?? [],
    lexicon: t.lexicon ?? {}, fields, byId: new Map(fields.map((f) => [f.id, f])),
    acceptsDocument: (d) => !docExclude.has(d.recordType) && (!docTypes || docTypes.has(d.recordType)),
    signature: sha256(JSON.stringify(t)).slice(0, 16),
    raw: t,
  }
}

const BUILTIN_DIR = new URL('../../templates/', import.meta.url)

/** List templates: built-in (templates/*.json) and the user's library (<stateDir>/templates). */
export async function listTemplates(stateDir) {
  const out = []
  const scan = async (dir, origin) => {
    let names = []
    try { names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort() } catch { return }
    for (const n of names) {
      try {
        const t = JSON.parse(await readFile(typeof dir === 'string' ? join(dir, n) : new URL(n, dir), 'utf8'))
        out.push({ id: t.id, name: t.name, version: t.version, description: t.description, domain: t.domain ?? null, fields: t.fields?.length ?? 0, origin, file: typeof dir === 'string' ? join(dir, n) : new URL(n, dir).pathname })
      } catch { /* skip unreadable */ }
    }
  }
  await scan(BUILTIN_DIR, 'builtin')
  if (stateDir) await scan(join(stateDir, 'templates'), 'user')
  // user templates override built-ins with the same id
  const byId = new Map()
  for (const t of out) if (!byId.has(t.id) || t.origin === 'user') byId.set(t.id, t)
  return [...byId.values()]
}

/** Load a template by id (user library first), or from a file path / inline object. */
export async function loadTemplate(ref, stateDir) {
  if (ref && typeof ref === 'object') return ref
  if (!ref) throw new Error('没有指定模板（template）')
  if (/[\\/]|\.json$/.test(ref)) return JSON.parse(await readFile(ref, 'utf8'))
  const hit = (await listTemplates(stateDir)).find((t) => t.id === ref)
  if (!hit) throw Object.assign(new Error(`找不到模板 ${ref}`), { code: 'template-missing' })
  return JSON.parse(await readFile(hit.file, 'utf8'))
}
