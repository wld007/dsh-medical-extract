import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readUnit } from '../lib/source/generic.js'
import { stableId } from '../lib/util.js'

// 记录键不唯一（同一流水号下几份检查报告）：每份文书仍各有一个编号；第一次出现的编号与以前一致
test('repeated record keys still give one id per document', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mx-ids-'))
  try {
    const file = join(dir, 'reports.csv')
    await writeFile(file, 'rid,pid,content\nK1,P1,第一份检查报告：两肺纹理增多\nK1,P1,第二份检查报告：右肺结节\nK2,P1,第三份检查报告：未见异常\n')
    const ids = []
    await readUnit({ kind: 'file', file }, { kind: '文书', text: ['content'], id: 'rid', patient: 'pid' }, dir, (d) => { if (d) ids.push(d.id) })
    assert.equal(ids.length, 3)
    assert.equal(new Set(ids).size, 3)
    assert.equal(ids[0], stableId('D', 'reports.csv', 'K1'))
    assert.equal(ids[2], stableId('D', 'reports.csv', 'K2'))
  } finally { await rm(dir, { recursive: true, force: true }) }
})
