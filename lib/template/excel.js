/**
 * 抽取模板 ⇄ Excel（xlsx）。导出再导入不丢信息（往返一致）；不认识的键放进"其他（JSON）"列原样带回。
 *
 *   模板      键 | 值（id、名称、版本、学科、说明、排除文书类型、限定文书类型、分组、依据、词表·…）
 *   字段      一行一个字段（见 FIELD_COLUMNS）
 *   规则      一行一条规则：字段ID、规则ID、正则、固定值、断言、栏目、映射（JSON）、系数
 *   填写说明  每列怎么填、可选值
 */
import * as XLSX from '../../vendor/xlsx.mjs'
import { ASSERTIONS, DERIVE_OPS, FORMAT, GRANULARITIES, PICKS, TYPES } from './load.js'

const SEP = '、'
const splitList = (s) => String(s ?? '').split(/[、\n]/).map((x) => x.trim()).filter(Boolean)
const splitLines = (s) => String(s ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
const cell = (v) => (v == null ? '' : String(v))

/** [列名, 读出（字段→单元格）, 写入（单元格→字段片段）, 说明, 可选值] */
const FIELD_COLUMNS = [
  ['字段ID', (f) => f.id, (v, f) => { f.id = v }, '必填。字母开头，字母、数字、下划线；模板内唯一。宽表列名就是它。'],
  ['名称', (f) => f.name, (v, f) => { f.name = v }, '必填。中文名。'],
  ['分组', (f) => f.group, (v, f) => { if (v) f.group = v }, '分组 ID（在"模板"表的"分组"行定义名称）。'],
  ['优先级', (f) => f.priority, (v, f) => { if (v) f.priority = v }, '默认 P1。', 'P0、P1、P2'],
  ['类型', (f) => f.type, (v, f) => { f.type = v }, '必填。presence＝有／无／可疑；enum＝单选；list＝多值；number＝数值；score＝量表分；date＝日期；text＝短文本；derived＝由其他字段计算。', TYPES.join('、')],
  ['粒度', (f) => f.granularity, (v, f) => { if (v) f.granularity = v }, '默认 encounter（一次就诊一值）。patient＝一人一值；document＝一份文书一值；timepoint＝每次测量一行。', GRANULARITIES.join('、')],
  ['汇总方式', (f) => f.pick, (v, f) => { if (v) f.pick = v }, '同一格子有多个值时取哪个；空＝按类型默认。', PICKS.join('、')],
  ['定义', (f) => f.definition, (v, f) => { f.definition = v }, '必填。给人和模型看：算什么。'],
  ['算', (f) => (f.include ?? []).join(SEP), (v, f) => { const x = splitList(v); if (x.length) f.include = x }, '算作该字段的写法或情形（"、"分隔）。'],
  ['不算', (f) => (f.exclude ?? []).join(SEP), (v, f) => { const x = splitList(v); if (x.length) f.exclude = x }, '不算的写法或情形（"、"分隔）。'],
  ['召回词', (f) => (f.recall?.terms ?? []).join(SEP), (v, f) => { const x = splitList(v); if (x.length) (f.recall ??= {}).terms = x }, '原文里出现这些词的句子才是候选（"、"分隔）。presence 字段靠它取值。'],
  ['召回正则', (f) => (f.recall?.regex ?? []).join('\n'), (v, f) => { const x = splitLines(v); if (x.length) (f.recall ??= {}).regex = x }, '可选。JavaScript 正则，一行一条。'],
  ['选项', (f) => (f.options ?? []).map((o) => (o.terms?.length ? `${o.value}：${o.terms.join(SEP)}` : o.value)).join('\n'), (v, f) => {
    const x = splitLines(v)
    if (x.length) f.options = x.map((line) => { const i = line.indexOf('：'); if (i < 0) return { value: line }
      const terms = splitList(line.slice(i + 1))
      return terms.length ? { value: line.slice(0, i).trim(), terms } : { value: line.slice(0, i).trim() }
    })
  }, 'enum／list 用。一行一个选项："规范值：写法1、写法2"；只写规范值表示只靠规则取值。'],
  ['单位', (f) => f.unit, (v, f) => { if (v) f.unit = v }, '数值字段的单位。'],
  ['单位换算', (f) => Object.entries(f.units ?? {}).map(([k, x]) => `${k}=${x}`).join(SEP), (v, f) => { const x = splitList(v); if (x.length) f.units = Object.fromEntries(x.map((p) => { const [k, n] = p.split('='); return [k.trim(), Number(n)] })) }, '原文单位=系数，如"斤=0.5"。'],
  ['最小值', (f) => f.range?.min, (v, f) => { if (v !== '') (f.range ??= {}).min = Number(v) }, '值域下限；超出的值标"超出值域"。'],
  ['最大值', (f) => f.range?.max, (v, f) => { if (v !== '') (f.range ??= {}).max = Number(v) }, '值域上限。'],
  ['量表', (f) => f.scale, (v, f) => { if (v) f.scale = v }, 'score 字段的量表名。'],
  ['版本写法', (f) => Object.entries(f.variants ?? {}).map(([k, x]) => `${k}=${[].concat(x).join('/')}`).join(SEP), (v, f) => { const x = splitList(v); if (x.length) f.variants = Object.fromEntries(x.map((p) => { const [k, n] = p.split('='); return [k.trim(), n.split('/').map((s) => s.trim())] })) }, '量表版本：规范名=原文写法，如"HAMD-17=17、HAMD-24=24"。'],
  ['语境', (f) => (f.accept ?? []).join(SEP), (v, f) => { const x = splitList(v); if (x.length) f.accept = x }, '哪些语境算"有"，默认"阳性"。既往史类填"阳性、既往"；家族史填"家族"。', ASSERTIONS.join('、')],
  ['来源文书类型', (f) => (f.sources?.recordTypes ?? []).join(SEP), (v, f) => { const x = splitList(v); if (x.length) (f.sources ??= {}).recordTypes = x }, '只在这些文书类型里找（"、"分隔）；空＝全部。'],
  ['来源栏目', (f) => (f.sources?.sections ?? []).join(SEP), (v, f) => { const x = splitList(v); if (x.length) (f.sources ??= {}).sections = x }, '只在这些栏目里找，如"主诉、现病史"；空＝全部。'],
  ['模型', (f) => f.model, (v, f) => { if (v) f.model = v }, 'auto（默认，规则定不了才送模型）／always（召回到就送）／never。', 'auto、always、never'],
  ['派生', (f) => (f.derive ? JSON.stringify(f.derive) : ''), (v, f) => { if (v) f.derive = JSON.parse(v) }, `derived 字段的计算（JSON），如 {"op":"ageAt","at":"B1"}。op 可选：${DERIVE_OPS.join('、')}。`],
  ['例子', (f) => (f.examples ?? []).map((e) => `${e.text} => ${e.value}`).join('\n'), (v, f) => { const x = splitLines(v); if (x.length) f.examples = x.map((l) => { const i = l.lastIndexOf('=>'); return { text: l.slice(0, i).trim(), value: l.slice(i + 2).trim() } }) }, '给模型看的例子（虚构），一行一个："原文 => 值"。'],
  ['其他（JSON）', (f) => { const r = rest(f); return Object.keys(r).length ? JSON.stringify(r) : '' }, (v, f) => { if (v) Object.assign(f, JSON.parse(v)) }, '不认识的设置原样保存；一般不用填。'],
]
const KNOWN = new Set(['id', 'name', 'group', 'priority', 'type', 'granularity', 'pick', 'definition', 'include', 'exclude', 'recall', 'options', 'unit', 'units', 'range', 'scale', 'variants', 'accept', 'sources', 'model', 'derive', 'examples', 'rules'])
function rest(f) {
  const r = {}
  for (const [k, v] of Object.entries(f)) if (!KNOWN.has(k)) r[k] = v
  if (f.recall) { const x = { ...f.recall }; delete x.terms; delete x.regex; if (Object.keys(x).length) r.recall = x }
  if (f.sources) { const x = { ...f.sources }; delete x.recordTypes; delete x.sections; if (Object.keys(x).length) r.sources = x }
  for (const o of f.options ?? []) if (Object.keys(o).some((k) => k !== 'value' && k !== 'terms')) { r.options = f.options; break }
  return r
}
const RULE_COLUMNS = [
  ['字段ID', '规则属于哪个字段。'], ['规则ID', '字段内唯一。'], ['正则', 'JavaScript 正则。命名分组 v＝值，date＝日期文本，unit＝单位，variant＝量表版本。'],
  ['固定值', '命中即取这个值（与分组 v 二选一）。'], ['断言', `可选：强制语境（${ASSERTIONS.join('、')}）。`], ['栏目', '可选：只在这些栏目生效（"、"分隔）。'],
  ['映射', '可选 JSON：原文写法→规范值，如 {"Ⅲ":"III"}。'], ['系数', '可选：数值乘以该系数（如 0.35 → 35 填 100）。'],
]

/** Template object → xlsx Buffer. blank: only headers + one example row. */
export function templateToXlsx(t, { blank = false } = {}) {
  const wb = XLSX.utils.book_new()
  const meta = [['键', '值'], ['id', blank ? 'my-topic' : t.id], ['名称', blank ? '我的课题' : t.name], ['版本', blank ? '0.1.0' : t.version], ['学科', blank ? '' : t.domain ?? ''],
    ['说明', blank ? '一句话说明这个模板用来做什么。' : t.description]]
  if (!blank) {
    if (t.documents?.excludeRecordTypes?.length) meta.push(['排除文书类型', t.documents.excludeRecordTypes.join(SEP)])
    if (t.documents?.recordTypes?.length) meta.push(['限定文书类型', t.documents.recordTypes.join(SEP)])
    for (const g of t.groups ?? []) meta.push(['分组', `${g.id}=${g.name}`])
    for (const r of t.references ?? []) meta.push(['依据', r.url ? `${r.title} | ${r.url}` : r.title])
    for (const [k, v] of Object.entries(t.lexicon ?? {})) meta.push([`词表·${k}`, [].concat(v).join(SEP)])
  } else meta.push(['分组', 'A=第一组'], ['依据', '指南名称 | https://…'])
  const wsMeta = XLSX.utils.aoa_to_sheet(meta); wsMeta['!cols'] = [{ wch: 16 }, { wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsMeta, '模板')

  const fields = blank ? [{ id: 'A1', name: '情绪低落', group: 'A', priority: 'P0', type: 'presence', definition: '患者当前存在情绪低落。', recall: { terms: ['情绪低落', '心情差'] } }] : t.fields
  const fRows = [FIELD_COLUMNS.map((c) => c[0]), ...fields.map((f) => FIELD_COLUMNS.map((c) => cell(c[1](f))))]
  const wsF = XLSX.utils.aoa_to_sheet(fRows)
  wsF['!cols'] = FIELD_COLUMNS.map(([n]) => ({ wch: { 定义: 40, 召回词: 30, 选项: 34, 召回正则: 30, '其他（JSON）': 20, 派生: 24, 例子: 24 }[n] ?? Math.max(8, n.length * 2 + 2) }))
  wsF['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: fRows.length - 1, c: FIELD_COLUMNS.length - 1 } }) }
  XLSX.utils.book_append_sheet(wb, wsF, '字段')

  const rRows = [RULE_COLUMNS.map((c) => c[0])]
  for (const f of fields) for (const r of f.rules ?? []) rRows.push([f.id, r.id, r.regex, cell(r.value), cell(r.assertion), (r.sections ?? []).join(SEP), r.map ? JSON.stringify(r.map) : '', r.factor ?? ''])
  const wsR = XLSX.utils.aoa_to_sheet(rRows); wsR['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 70 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 24 }, { wch: 6 }]
  XLSX.utils.book_append_sheet(wb, wsR, '规则')

  const help = [['表', '列', '怎么填', '可选值'],
    ['模板', 'id', '必填。小写字母开头，小写字母、数字、连字符；与内置模板同 id 时，用你的版本。', ''],
    ['模板', '名称／版本／学科／说明', '名称、版本、说明必填；版本如 0.1.0，改了字段就升版本。', ''],
    ['模板', '分组', '每行一个："分组ID=名称"。', ''], ['模板', '依据', '每行一个："指南名称 | 链接"，链接可省。', ''],
    ['模板', '排除文书类型／限定文书类型', '整份模板只看（或不看）这些文书类型，"、"分隔。', ''],
    ...FIELD_COLUMNS.map(([n, , , d, opts]) => ['字段', n, d, opts ?? '']),
    ...RULE_COLUMNS.map(([n, d]) => ['规则', n, d, '']),
  ]
  const wsH = XLSX.utils.aoa_to_sheet(help); wsH['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 90 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, wsH, '填写说明')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

/**
 * xlsx Buffer → { template, problems }. problems point at sheet/row/column; the template is
 * returned even when problems exist (caller validates and decides).
 */
export function xlsxToTemplate(buf) {
  const problems = []
  let wb
  try { wb = XLSX.read(buf, { type: 'buffer' }) } catch (e) { return { template: null, problems: [`读不了这个文件：${e.message}`] } }
  const sheet = (name) => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false }) : null
  const metaRows = sheet('模板'); const fRows = sheet('字段'); const rRows = sheet('规则')
  if (!metaRows) problems.push('缺少"模板"表')
  if (!fRows) problems.push('缺少"字段"表')
  if (!metaRows || !fRows) return { template: null, problems }

  const t = { format: FORMAT }
  const groups = []; const references = []; const lexicon = {}
  for (const [i, row] of metaRows.slice(1).entries()) {
    const k = String(row[0] ?? '').trim(); const v = String(row[1] ?? '').trim()
    if (!k) continue
    if (k === 'id') t.id = v
    else if (k === '名称') t.name = v
    else if (k === '版本') t.version = v
    else if (k === '学科') { if (v) t.domain = v }
    else if (k === '说明') t.description = v
    else if (k === '排除文书类型') (t.documents ??= {}).excludeRecordTypes = splitList(v)
    else if (k === '限定文书类型') (t.documents ??= {}).recordTypes = splitList(v)
    else if (k === '分组') { const j = v.indexOf('='); if (j < 0) problems.push(`模板表第 ${i + 2} 行：分组应写成"ID=名称"`); else groups.push({ id: v.slice(0, j).trim(), name: v.slice(j + 1).trim() }) }
    else if (k === '依据') { const [title, url] = v.split(/\s+\|\s+/); if (title) references.push(url ? { title: title.trim(), url: url.trim() } : { title: title.trim() }) }
    else if (k.startsWith('词表·')) lexicon[k.slice(3)] = splitList(v)
    else problems.push(`模板表第 ${i + 2} 行：不认识的键"${k}"`)
  }
  if (groups.length) t.groups = groups
  if (references.length) t.references = references
  if (Object.keys(lexicon).length) t.lexicon = lexicon

  const head = (fRows[0] ?? []).map((h) => String(h).trim())
  const idx = Object.fromEntries(FIELD_COLUMNS.map(([n]) => [n, head.indexOf(n)]))
  for (const n of ['字段ID', '名称', '类型', '定义']) if (idx[n] < 0) problems.push(`字段表缺少"${n}"列`)
  for (const h of head) if (h && !FIELD_COLUMNS.some(([n]) => n === h)) problems.push(`字段表有不认识的列"${h}"（已忽略）`)
  t.fields = []
  for (const [i, row] of fRows.slice(1).entries()) {
    if (!row.some((x) => String(x).trim())) continue
    const f = {}
    for (const [n, , write] of FIELD_COLUMNS) {
      if (idx[n] < 0) continue
      const v = String(row[idx[n]] ?? '').trim()
      try { write(v, f) } catch (e) { problems.push(`字段表第 ${i + 2} 行"${n}"列：${e.message}`) }
    }
    t.fields.push(f)
  }
  if (rRows) {
    const rh = (rRows[0] ?? []).map((h) => String(h).trim())
    const ri = Object.fromEntries(RULE_COLUMNS.map(([n]) => [n, rh.indexOf(n)]))
    const byId = new Map(t.fields.map((f) => [f.id, f]))
    for (const [i, row] of rRows.slice(1).entries()) {
      const g = (n) => (ri[n] < 0 ? '' : String(row[ri[n]] ?? '').trim())
      if (!g('字段ID') && !g('正则')) continue
      const f = byId.get(g('字段ID'))
      if (!f) { problems.push(`规则表第 ${i + 2} 行：字段 ${g('字段ID')} 不在字段表里`); continue }
      const r = { id: g('规则ID'), regex: String(row[ri['正则']] ?? '') }
      const fixed = g('固定值')
      if (fixed !== '') r.value = /^-?\d+(?:\.\d+)?$/.test(fixed) && ['number', 'score'].includes(f.type) ? Number(fixed) : fixed
      if (g('断言')) r.assertion = g('断言')
      if (g('栏目')) r.sections = splitList(g('栏目'))
      if (g('映射')) { try { r.map = JSON.parse(g('映射')) } catch (e) { problems.push(`规则表第 ${i + 2} 行"映射"列不是合法 JSON：${e.message}`) } }
      if (g('系数') !== '') r.factor = Number(g('系数'))
      ;(f.rules ??= []).push(r)
    }
  }
  return { template: t, problems }
}
