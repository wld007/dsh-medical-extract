import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createService } from '../lib/service.js'

// 设置页的模型下拉：读 /models；已保存的 Key 只发往已保存的端点
test('models: list from /models, saved key only to saved endpoint', async () => {
  const seen = []
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization ?? '' })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'b-model' }, { id: 'a-model' }, { id: 'a-model' }] }))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const saved = `http://127.0.0.1:${port}/v1`
  try {
    const s = createService({ config: { baseURL: saved, apiKey: 'sk-saved' } })
    const a = await s.models({})
    assert.deepEqual(a, { ok: true, models: ['a-model', 'b-model'] })
    assert.equal(seen.at(-1).url, '/v1/models')
    assert.equal(seen.at(-1).auth, 'Bearer sk-saved')
    // another address: the saved key is not sent there
    await s.models({ baseURL: `http://localhost:${port}/v1/` })
    assert.equal(seen.at(-1).auth, '')
    // a key typed on the page goes with the typed address
    await s.models({ baseURL: `http://localhost:${port}/v1`, apiKey: 'sk-typed' })
    assert.equal(seen.at(-1).auth, 'Bearer sk-typed')
    const none = await createService({ config: {} }).models({})
    assert.equal(none.ok, false)
  } finally { server.close() }
})
