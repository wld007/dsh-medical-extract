/**
 * templates/src/*.mjs → templates/*.json（校验通过才写），并生成 docs/templates.md（内置模板清单）。
 *   node scripts/build-templates.mjs
 */
import { readdir, writeFile } from 'node:fs/promises'
import { validateTemplate } from '../lib/template/load.js'

const dir = new URL('../templates/', import.meta.url)
let failed = false
const built = []
for (const name of (await readdir(new URL('src/', dir))).filter((n) => n.endsWith('.mjs') && !n.startsWith('_')).sort()) {
  const t = (await import(new URL(`src/${name}`, dir))).default
  const problems = validateTemplate(t)
  if (problems.length) { failed = true; console.error(`${name}:\n- ${problems.join('\n- ')}`); continue }
  await writeFile(new URL(`${t.id}.json`, dir), `${JSON.stringify(t, null, 2)}\n`)
  built.push(t)
  console.log(`${t.id}.json  ${t.fields.length} 字段`)
}
if (failed) process.exit(1)

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const TYPE = { presence: '有／无', enum: '选项', number: '数值', score: '量表分', date: '日期', text: '文本', list: '多值', derived: '派生' }
const GRAN = { patient: '病人', encounter: '就诊', document: '文书', timepoint: '时间点' }
const lines = ['# 内置模板清单', '', '> 由 `node scripts/build-templates.mjs` 从 `templates/src/*.mjs` 生成，不要手改。', '> 内置模板与用户模板格式相同（见 [template.md](template.md)），在页面上可以"复制为我的模板"后修改。', '']
lines.push('| 模板 id | 名称 | 学科 | 字段 | P0 |', '|---|---|---|---|---|')
for (const t of built) lines.push(`| [\`${t.id}\`](#${t.id}) | ${esc(t.name)} | ${esc(t.domain)} | ${t.fields.length} | ${t.fields.filter((f) => f.priority === 'P0').length} |`)
for (const t of built) {
  lines.push('', `## ${t.id}`, '', `**${esc(t.name)}** v${t.version}：${esc(t.description)}`, '')
  if (t.references?.length) { lines.push('依据：', ''); for (const r of t.references) lines.push(`- ${r.url ? `[${r.title}](${r.url})` : r.title}`); lines.push('') }
  const gname = Object.fromEntries((t.groups ?? []).map((g) => [g.id, g.name]))
  lines.push('| 字段 | 名称 | 组 | 优先级 | 类型 | 粒度 | 定义 |', '|---|---|---|---|---|---|---|')
  for (const f of t.fields) lines.push(`| ${f.id} | ${esc(f.name)} | ${esc(gname[f.group] ?? f.group)} | ${f.priority ?? 'P1'} | ${TYPE[f.type] ?? f.type} | ${GRAN[f.granularity ?? 'encounter']} | ${esc(f.definition)} |`)
}
await writeFile(new URL('../docs/templates.md', import.meta.url), `${lines.join('\n')}\n`)
console.log('docs/templates.md')
