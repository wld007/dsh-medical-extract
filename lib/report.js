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
  lines.push(`# 病历文书提取 · 批次 ${run.id}`, '')
  lines.push('| 项 | 值 |', '|---|---|')
  const kv = [
    ['状态', run.status], ['输入', run.input], ['格式', run.plan?.format ?? '—'], ['模板', `${tpl.name}（${tpl.id} v${tpl.version}）`],
    ['模式', run.mode], ['提取模型', run.model?.model ?? '未配置'], ['核验模型', run.model?.verifyModel || '未配置（不做抽样核验）'],
    ['截至时刻', run.asOf ?? '不截断'], ['开始', run.startedAt], ['结束', run.finishedAt ?? '—'],
    ['提取方式', { read: '分配后模型通读（有规则的字段再用规则对照）', rules: '仅规则（已停用）', recall: '关键词定位后送片段（已停用）' }[run.flow] ?? '—'],
    ['数据块', `${n(run.shards?.done)} / ${n(run.shards?.total)}`], ['文书', n(t.documents)], ['结构化记录（不提取）', n(t.structured)],
    ['空白文书（清洗后无内容，不提取）', n(t.hollow)], ['清洗：解码／去乱码', `${n(t.decoded)} ／ ${n(t.garbled)} 个字段值`], ['清洗：去掉图片与二进制', `${n(t.media)} 处${Object.keys(t.mediaKinds ?? {}).length ? `（${Object.entries(t.mediaKinds).map(([k, v]) => `${k} ${n(v)}`).join('，')}）` : ''}；不识别图片里的文字`], ['截至时刻以后跳过', n(t.skipped)],
    ...(run.flow === 'read' ? [['分配：提取任务', n(t.tasks)], ['分配：字段 × 文书', n(t.assigned)], ['规则匹配', `${n(t.votes)}（与模型一致 ${n(t.agree)}，不一致进复核 ${n(t.ruleDisputes)} 项）`]] : [['关键词命中（字段 × 文书）', n(t.recalled)]]),
    ...(t.noKeyword ? [['无关键词整份跳过', n(t.noKeyword)]] : []),
    ['病人', n(t.patients)], ['就诊', n(t.encounters)], ['值', n(t.values)], ['冲突', n(t.conflicts)], ['待复核', n(t.review)],
    ['模型调用', `${n(t.calls)}（缓存命中 ${n(t.cached)}，失败 ${n(t.failed)}）`],
    ['交付', run.output ?? '—'],
  ]
  for (const [k, v] of kv) lines.push(`| ${k} | ${String(v ?? '—').replace(/\|/g, '\\|')} |`)
  lines.push('', '## 质检', '', '| 项 | 内容 | 结果 |', '|---|---|---|')
  for (const g of run.gates ?? []) lines.push(`| ${g.id} | ${g.label} | ${g.pass ? '通过' : '**未过**'} · ${g.detail} |`)
  if (run.flow === 'read' && (t.adjResolved || t.review || t.ruleDisputes)) {
    lines.push('', '## 复查', '', `核验分歧、规则与模型不符的项，两个模型先轮流复查（至多 ${run.maxRounds ?? 3} 轮），一致即采用，仍不一致转人工。质检④按复查前的一致率。`, '')
    lines.push(`- 复查后自动一致：${n(t.adjResolved ?? 0)}${(t.adjByRound ?? []).some(Boolean) ? `（${(t.adjByRound ?? []).map((x, i) => (x ? `第 ${i + 1} 轮 ${x}` : null)).filter(Boolean).join('、')}）` : ''}`)
    lines.push(`- 转人工：${n(t.review)}`)
    lines.push(`- 复查调用模型：${n(t.adjCalls ?? 0)} 次`)
  }
  if (run.needsDefinition?.length) {
    lines.push('', '## 需要改字段定义', '', '复查前一致率不达标的字段：复查只修好了被抽到的文书，没被抽到的只有第一遍的结果，重跑不会变。看复核里的分歧，改模板里这个字段的定义、算／不算的写法或例子。', '', '| 字段 | 名称 | 抽样 | 复查前一致 | 原因 |', '|---|---|---|---|---|')
    for (const x of run.needsDefinition) lines.push(`| ${x.field} | ${tpl.fields?.find?.((f) => f.id === x.field)?.name ?? (tpl.byId?.get?.(x.field)?.name ?? '')} | ${x.n} | ${pct(x.agree / x.n)} | ${x.why} |`)
  }
  lines.push('', '## 值的来源', '')
  for (const [k, v] of Object.entries(t.byMethod ?? {})) lines.push(`- ${k}：${n(v)}`)
  lines.push('', '## 字段', '', '| 字段 | 名称 | 优先级 | 汇总层级 | 值 | 单元格填充 | 抽样一致率 | 常见取值 |', '|---|---|---|---|---|---|---|---|')
  for (const r of fieldRows(run, tpl)) {
    lines.push(`| ${r.id} | ${r.name} | ${r.priority} | ${r.granularity} | ${n(r.values)} | ${r.rows ? `${n(r.filled)}/${n(r.rows)}（${pct(r.fillRate)}）` : '—'} | ${r.verifyN ? `${pct(r.agreement)}（n=${r.verifyN}）` : '—'} | ${r.top.map(([k, c]) => `${String(k).slice(0, 12)}×${c}`).join('，').replace(/\|/g, '/')} |`)
  }
  if (run.problems?.length) {
    lines.push('', '## 被丢弃的模型回答（举例）', '')
    for (const p of run.problems.slice(0, 20)) lines.push(`- ${p.field}：${p.problem}`)
  }
  if (run.warnings?.length) { lines.push('', '## 提示', ''); for (const w of run.warnings) lines.push(`- ${w}`) }
  if (run.error) lines.push('', '## 错误', '', '```', run.error.split('\n').slice(0, 8).join('\n'), '```')
  lines.push('')
  return lines.join('\n')
}
