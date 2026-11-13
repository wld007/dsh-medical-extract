/**
 * 批次报告（Markdown ＋ JSON）。不含病历原文。
 */
const pct = (x) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1)}%`)
const n = (x) => (x == null ? '—' : Number(x).toLocaleString('en-US'))

export function fieldRows(run, tpl) {
  const filled = run.rollup?.filled ?? {}
  return tpl.fields.map((f) => {
    const s = filled[f.id] ?? { rows: 0, filled: 0, values: {} }
    const ex = run.byField?.[f.id] ?? { values: 0, docs: 0 }
    const v = run.verify?.[f.id]
    return {
      id: f.id, name: f.name, group: f.group ?? '', priority: f.priority, type: f.type, granularity: f.granularity,
      values: ex.values, docs: ex.docs, rows: s.rows, filled: s.filled, fillRate: s.rows ? s.filled / s.rows : null,
      top: Object.entries(s.values).filter(([k]) => k).sort((a, b) => b[1] - a[1]).slice(0, 4),
      verifyN: v?.n ?? 0, agreement: v?.n ? v.agree / v.n : null,
    }
  })
}

export function renderReport(run, tpl) {
  const t = run.totals
  const lines = []
  lines.push(`# 病历定向抽取 · 批次 ${run.id}`, '')
  lines.push('| 项 | 值 |', '|---|---|')
  const kv = [
    ['状态', run.status], ['输入', run.input], ['格式', run.plan?.format ?? '—'], ['模板', `${tpl.name}（${tpl.id} v${tpl.version}）`],
    ['模式', run.mode], ['抽取模型', run.model?.model ?? '未配置（仅规则）'], ['核验模型', run.model?.verifyModel || '未配置（不做抽样核验）'],
    ['截至时刻', run.asOf ?? '不截断'], ['开始', run.startedAt], ['结束', run.finishedAt ?? '—'],
    ['分片', `${n(run.shards?.done)} / ${n(run.shards?.total)}`], ['文书', n(t.documents)], ['截至时刻以后跳过', n(t.skipped)],
    ['病人', n(t.patients)], ['就诊', n(t.encounters)], ['值', n(t.values)], ['冲突', n(t.conflicts)], ['待复核', n(t.review)],
    ['模型调用', `${n(t.calls)}（缓存命中 ${n(t.cached)}，失败 ${n(t.failed)}）`],
    ['交付', run.output ?? '—'],
  ]
  for (const [k, v] of kv) lines.push(`| ${k} | ${String(v ?? '—').replace(/\|/g, '\\|')} |`)
  lines.push('', '## 验收门', '', '| 门 | 内容 | 结果 |', '|---|---|---|')
  for (const g of run.gates ?? []) lines.push(`| ${g.id} | ${g.label} | ${g.pass ? '通过' : '**未过**'} · ${g.detail} |`)
  lines.push('', '## 取值途径', '')
  for (const [k, v] of Object.entries(t.byMethod ?? {})) lines.push(`- ${k}：${n(v)}`)
  lines.push('', '## 字段', '', '| 字段 | 名称 | 优先级 | 粒度 | 值 | 格子填充 | 抽样一致率 | 常见取值 |', '|---|---|---|---|---|---|---|---|')
  for (const r of fieldRows(run, tpl)) {
    lines.push(`| ${r.id} | ${r.name} | ${r.priority} | ${r.granularity} | ${n(r.values)} | ${r.rows ? `${n(r.filled)}/${n(r.rows)}（${pct(r.fillRate)}）` : '—'} | ${r.verifyN ? `${pct(r.agreement)}（n=${r.verifyN}）` : '—'} | ${r.top.map(([k, c]) => `${String(k).slice(0, 12)}×${c}`).join('，').replace(/\|/g, '/')} |`)
  }
  if (run.problems?.length) {
    lines.push('', '## 被丢弃的模型回答（样例）', '')
    for (const p of run.problems.slice(0, 20)) lines.push(`- ${p.field}：${p.problem}`)
  }
  if (run.warnings?.length) { lines.push('', '## 提示', ''); for (const w of run.warnings) lines.push(`- ${w}`) }
  if (run.error) lines.push('', '## 错误', '', '```', run.error.split('\n').slice(0, 8).join('\n'), '```')
  lines.push('')
  return lines.join('\n')
}
