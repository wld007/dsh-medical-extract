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
    ['模式', run.mode], ['抽取模型', run.model?.model ?? '未配置（仅规则）'], ['核验模型', run.model?.verifyModel || '未配置（不做抽样核验）'],
    ['截至时刻', run.asOf ?? '不截断'], ['开始', run.startedAt], ['结束', run.finishedAt ?? '—'],
    ['取值方式', { read: '分派后模型通读（规则出规则票）', rules: '仅规则（关键词定位＋规则取值）', recall: '旧流程：关键词定位后送片段（对比用）' }[run.flow] ?? '—'],
    ['分片', `${n(run.shards?.done)} / ${n(run.shards?.total)}`], ['文书', n(t.documents)], ['结构化记录（不抽取）', n(t.structured)],
    ['空壳文书（清洗后无内容，不抽取）', n(t.hollow)], ['清洗：解码／去乱码', `${n(t.decoded)} ／ ${n(t.garbled)} 个取值`], ['清洗：去掉图片与二进制', `${n(t.media)} 处${Object.keys(t.mediaKinds ?? {}).length ? `（${Object.entries(t.mediaKinds).map(([k, v]) => `${k} ${n(v)}`).join('，')}）` : ''}；不识别图片里的文字`], ['截至时刻以后跳过', n(t.skipped)],
    ...(run.flow === 'read' ? [['分派：抽取任务', n(t.tasks)], ['分派：字段 × 文书', n(t.assigned)], ['规则票', `${n(t.votes)}（与模型一致 ${n(t.agree)}，不一致进复核 ${n(t.ruleDisputes)} 项）`]] : [['关键词命中（字段 × 文书）', n(t.recalled)]]),
    ...(t.noKeyword ? [['无关键词整份跳过', n(t.noKeyword)]] : []),
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
    lines.push('', '## 被丢弃的模型回答（举例）', '')
    for (const p of run.problems.slice(0, 20)) lines.push(`- ${p.field}：${p.problem}`)
  }
  if (run.warnings?.length) { lines.push('', '## 提示', ''); for (const w of run.warnings) lines.push(`- ${w}`) }
  if (run.error) lines.push('', '## 错误', '', '```', run.error.split('\n').slice(0, 8).join('\n'), '```')
  lines.push('')
  return lines.join('\n')
}
