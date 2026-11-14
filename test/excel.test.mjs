import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as XLSX from '../vendor/xlsx.mjs'
import { templateToXlsx, xlsxToTemplate } from '../lib/template/excel.js'
import { validateTemplate } from '../lib/template/load.js'
import { createService } from '../lib/service.js'
import { tmp } from './helpers.mjs'

const dir = new URL('../templates/', import.meta.url)
const builtins = await Promise.all((await readdir(dir)).filter((n) => n.endsWith('.json')).map(async (n) => JSON.parse(await readFile(new URL(n, dir), 'utf8'))))

test('Excel 往返：7 个内置模板导出再导入，一字不差', () => {
  for (const t of builtins) {
    const { template, problems } = xlsxToTemplate(templateToXlsx(t))
    assert.deepEqual(problems, [], t.id)
    assert.deepEqual(template, t, t.id)
  }
})

test('空白模板：有四张表，导入后就是一个能用的模板', () => {
  const buf = templateToXlsx({}, { blank: true })
  const wb = XLSX.read(buf, { type: 'buffer' })
  assert.deepEqual(wb.SheetNames, ['模板', '字段', '规则', '填写说明'])
  const { template, problems } = xlsxToTemplate(buf)
  assert.deepEqual(problems, [])
  assert.deepEqual(validateTemplate(template), [])
})

/** 用户在 Excel 里写的模板（行列直接构造） */
function userWorkbook({ fieldRows, ruleRows = [], meta = [] }) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['键', '值'], ['id', 'copd'], ['名称', '慢阻肺课题'], ['版本', '0.1.0'], ['说明', '慢阻肺急性加重研究'], ['分组', 'A=症状'], ...meta]), '模板')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['字段ID', '名称', '分组', '优先级', '类型', '粒度', '定义', '召回词', '选项', '最小值', '最大值', '单位'], ...fieldRows]), '字段')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['字段ID', '规则ID', '正则', '固定值'], ...ruleRows]), '规则')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

test('导入用户编写的 Excel：选项、值域、规则都对；错误指到行列', () => {
  const ok = xlsxToTemplate(userWorkbook({
    fieldRows: [
      ['A1', '咳嗽', 'A', 'P0', 'presence', '', '当前咳嗽。', '咳嗽、咳痰', '', '', '', ''],
      ['A2', '急性加重严重程度', 'A', 'P0', 'enum', 'encounter', '急性加重分级。', '', '轻度：轻度加重\n中度：中度加重\n重度：重度加重、需住院', '', '', ''],
      ['A3', 'FEV1%pred', 'A', 'P1', 'number', 'timepoint', 'FEV1 占预计值百分比。', '', '', 10, 150, '%'],
    ],
    ruleRows: [['A3', 'fev1', 'FEV1%?(?:pred|占预计值)[^。；\\n\\d]{0,10}?(?<v>\\d{1,3}(?:\\.\\d)?)', '']],
  }))
  assert.deepEqual(ok.problems, [])
  assert.deepEqual(validateTemplate(ok.template), [])
  const [a1, a2, a3] = ok.template.fields
  assert.deepEqual(a1.recall, { terms: ['咳嗽', '咳痰'] })
  assert.deepEqual(a2.options, [{ value: '轻度', terms: ['轻度加重'] }, { value: '中度', terms: ['中度加重'] }, { value: '重度', terms: ['重度加重', '需住院'] }])
  assert.deepEqual(a3.range, { min: 10, max: 150 })
  assert.equal(a3.rules[0].id, 'fev1')

  const bad = xlsxToTemplate(userWorkbook({
    fieldRows: [['B1', '呼吸困难', 'A', 'P0', 'yesno', '', '呼吸困难。', '气促', '', '', '', '']],
    ruleRows: [['Z9', 'x', 'abc', '']],
    meta: [['分组', '没有等号']],
  }))
  const all = [...bad.problems, ...validateTemplate(bad.template)]
  assert.ok(all.some((p) => p.includes('规则表第 2 行') && p.includes('Z9')))
  assert.ok(all.some((p) => p.includes('分组应写成')))
  assert.ok(all.some((p) => p.includes('B1') && p.includes('type')))
})

test('服务：导入 Excel 存进我的模板，列表里能选；校验不过不保存', async () => {
  const root = await tmp()
  const svc = createService({ config: {}, stateDir: join(root, 'state') })
  const good = userWorkbook({ fieldRows: [['A1', '咳嗽', 'A', 'P0', 'presence', '', '当前咳嗽。', '咳嗽', '', '', '', '']] })
  const r = await svc.importTemplateXlsx({ base64: Buffer.from(good).toString('base64') })
  assert.equal(r.saved, true, r.problems.join('\n'))
  const list = (await svc.templates()).templates
  assert.ok(list.some((t) => t.id === 'copd' && t.origin === 'user'))
  // 从文件路径导入（Agent 用）、校验不过
  const badFile = join(root, 'bad.xlsx')
  await writeFile(badFile, userWorkbook({ fieldRows: [['A1', '咳嗽', 'A', 'P0', 'nope', '', '当前咳嗽。', '咳嗽', '', '', '', '']] }))
  const r2 = await svc.importTemplateXlsx({ path: badFile })
  assert.equal(r2.saved, false)
  assert.ok(r2.problems.some((p) => p.includes('type')))
  // 导出：内置与空白
  const x = await svc.templateXlsx({ id: 'hf' })
  assert.match(x.name, /抽取模板-hf-v/)
  assert.deepEqual(xlsxToTemplate(Buffer.from(x.base64, 'base64')).template, builtins.find((t) => t.id === 'hf'))
  await svc.dispose()
})
