/**
 * templates/src/*.mjs → templates/*.json（校验通过才写）。node scripts/build-templates.mjs
 */
import { readdir, writeFile } from 'node:fs/promises'
import { validateTemplate } from '../lib/template/load.js'

const dir = new URL('../templates/', import.meta.url)
let failed = false
for (const name of (await readdir(new URL('src/', dir))).filter((n) => n.endsWith('.mjs'))) {
  const t = (await import(new URL(`src/${name}`, dir))).default
  const problems = validateTemplate(t)
  if (problems.length) { failed = true; console.error(`${name}:\n- ${problems.join('\n- ')}`); continue }
  await writeFile(new URL(`${t.id}.json`, dir), `${JSON.stringify(t, null, 2)}\n`)
  console.log(`${t.id}.json  ${t.fields.length} 字段`)
}
if (failed) process.exit(1)
