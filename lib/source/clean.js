/**
 * 读入·清洗：每个取值进文书前先洗一遍，文书拼好后再判断是不是空壳。
 *
 *   图片   整段 base64 的图片、PDF、压缩包等二进制丢掉；HTML／XML／RTF 转成文字，其中的图片（<img>、\pict、
 *          嵌入对象）丢掉；文中夹的 data URI 和长 base64 串删掉。图片里的内容不识别（不做 OCR），只计数报告
 *   解码  短 base64 取值（如 "LQ==" → "-"）解码成文字；嵌入的 XML／HTML 文书转成文字
 *   去乱码  上游导出把 Java 对象列表直接 toString 的残留：
 *          `…"], org.dom4j.tree.DefaultText@3d859866 [Text: "…` → 把各段文字接回去
 *   占位   null、-、/ 这类取值不算内容，不进文书
 *   空壳   文书里各栏目的内容加起来不到 2 个汉字：不进提取，计入"空壳文书"
 *
 * stats（可选）：{ decoded, garbled, media, mediaKinds } 累加，报告里给占比。
 */
import { decodeEmbedded, looksBase64 } from '../recognize/read.js'

const CJK = /[\u4e00-\u9fff]/g
const JAVA_OBJ = /"?\]*\s*,?\s*(?:org\.dom4j|org\.w3c|java\.lang)\.[\w.]+@[0-9a-f]{4,}\s*\[\w+:\s*"?/g
const JAVA_TAIL = /"\]+\s*$/
const JAVA_HEAD = /^\s*\[+/
const B64_SHORT = /^[A-Za-z0-9+/]{2,}={0,2}$/

/** 短 base64 → 文字；解不出可读文字就返回 null */
export function decodeShortBase64(v) {
  const s = v.trim()
  if (s.length > 4096 || s.length % 4 !== 0 || !B64_SHORT.test(s)) return null
  if (!s.includes('=') && s.length < 8) return null
  let out
  try { out = Buffer.from(s, 'base64').toString('utf8') } catch { return null }
  if (!out || /[\uFFFD\u0000-\u0008\u000E-\u001F]/.test(out)) return null
  if (Buffer.from(out, 'utf8').toString('base64').replace(/=+$/, '') !== s.replace(/=+$/, '')) return null
  return out
}

/* ------------------------------------------------------------ 图片与二进制 */

// 文件头 → 是什么（只用于计数和报告）
const MAGIC = [['89504e47', '图片'], ['ffd8ff', '图片'], ['47494638', '图片'], ['424d', '图片'], ['49492a00', '图片'], ['4d4d002a', '图片'], ['52494646', '图片'], ['25504446', 'PDF'], ['504b0304', '压缩包'], ['d0cf11e0', 'Office 文件']]
const DATA_URI = /data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+/g
// 文中夹的长 base64 串：200 个以上 base64 字符连着、没有空格标点，几乎只可能是二进制
const B64_RUN = /[A-Za-z0-9+/]{200,}={0,2}/g
const MARKUP = /^\s*<(?:\?xml|!DOCTYPE|html|body|div|p|span|table|[A-Za-z][\w:.-]*[\s>])/i
const kindOfBytes = (buf) => { const h = buf.subarray(0, 4).toString('hex'); return MAGIC.find(([m]) => h.startsWith(m))?.[1] ?? '二进制' }
// 二进制的 base64 是随机字符：大小写字母和数字都有。编码串（"LIS26504+LIS26507"）、十六进制哈希不会同时有
const mixed = (x) => /[a-z]/.test(x) && /[A-Z]/.test(x) && /\d/.test(x)
/** base64 解出来是不是可读文字（UTF-8，没有乱码和控制字符） */
function asText(buf) {
  const t = buf.toString('utf8')
  if (!t || /[\uFFFD\u0000-\u0008\u000E-\u001F]/.test(t)) return null
  return t
}

/**
 * RTF → 纯文字（不少电子病历编辑器存 RTF）。图片（\pict）、嵌入对象（\object、\objdata）、\bin 数据、
 * 字体表、样式表、颜色表整组丢掉；\'xx 按 GBK 解码，\uN 按 Unicode。
 */
export function rtfToText(rtf, stats = null) {
  const DROP = /^(?:pict|object|objdata|bin|fonttbl|colortbl|stylesheet|info|themedata|datastore|latentstyles|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|mmathPr|shppict|nonshppict|blipuid)$/
  let out = ''; let i = 0; const bytes = []; let skipDepth = -1; let depth = 0; let uc = 1; let pendingSkip = 0
  const flushBytes = () => { if (bytes.length) { try { out += new TextDecoder('gbk').decode(Uint8Array.from(bytes)) } catch { out += Buffer.from(bytes).toString('latin1') } bytes.length = 0 } }
  while (i < rtf.length) {
    const c = rtf[i]
    if (c === '{') { depth++; i++; continue }
    if (c === '}') { if (depth === skipDepth) skipDepth = -1; depth--; i++; continue }
    if (c === '\\') {
      const m = rtf.slice(i).match(/^\\(?:([a-zA-Z]+)(-?\d+)? ?|'([0-9a-fA-F]{2})|([^a-zA-Z]))/)
      if (!m) { i++; continue }
      i += m[0].length
      if (skipDepth >= 0) continue
      if (m[3]) { if (pendingSkip > 0) { pendingSkip--; continue } bytes.push(parseInt(m[3], 16)); continue }
      flushBytes()
      if (m[4]) { if (m[4] === '*') { skipDepth = depth } else if (m[4] === '~') out += ' '; else if ('\\{}'.includes(m[4])) out += m[4]; continue }
      const w = m[1]
      if (DROP.test(w)) { skipDepth = depth; if (stats && (w === 'pict' || w === 'object' || w === 'objdata' || w === 'bin')) stats.media = (stats.media ?? 0) + 1; continue }
      if (w === 'uc') { uc = Number(m[2] ?? 1); continue }
      if (w === 'u') { let n = Number(m[2]); if (n < 0) n += 65536; out += String.fromCharCode(n); pendingSkip = uc; continue }
      if (w === 'par' || w === 'line' || w === 'row' || w === 'sect' || w === 'page') out += '\n'
      else if (w === 'tab' || w === 'cell') out += '\t'
      continue
    }
    if (skipDepth >= 0 || c === '\r' || c === '\n') { i++; continue }
    if (pendingSkip > 0) { pendingSkip--; i++; continue }
    flushBytes()
    out += c; i++
  }
  flushBytes()
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 去掉图片与二进制：整段 base64（图片、PDF……）→ 空；HTML／XML／RTF → 文字（图片丢掉）；文中的 data URI、长 base64 串删掉 */
export function stripMedia(s, stats = null) {
  const t = s.trim()
  const bump = (kind = '二进制') => { if (stats) { stats.media = (stats.media ?? 0) + 1; (stats.mediaKinds ??= {})[kind] = (stats.mediaKinds[kind] ?? 0) + 1 } }
  if (looksBase64(t) && mixed(t)) {
    const decoded = () => { if (stats) stats.decoded = (stats.decoded ?? 0) + 1 }
    const d = decodeEmbedded(t)
    if (d) { decoded(); return d.text }
    const buf = Buffer.from(t.replace(/\s+/g, ''), 'base64')
    const head = buf.subarray(0, 200).toString('latin1')
    if (/^\s*\{\\rtf/.test(head)) { decoded(); return rtfToText(buf.toString('latin1'), stats) }
    // 外层是 XML、正文是压缩包（如 <document compression="7zip"><content>…</content>）：不解，计数报告
    const kind = /^\s*</.test(head) && /compression\s*=/.test(head) ? '压缩文书（未解）' : null
    if (!kind) { const txt = asText(buf); if (txt != null) { decoded(); return txt } }
    bump(kind ?? kindOfBytes(buf))
    return ''
  }
  if (/^\{\\rtf/.test(t)) return rtfToText(t, stats)
  let x = s
  if (x.includes('data:') && DATA_URI.test(x)) { DATA_URI.lastIndex = 0; x = x.replace(DATA_URI, (m) => { bump(/^data:image\//.test(m) ? '图片' : '二进制'); return '' }) }
  DATA_URI.lastIndex = 0
  if (MARKUP.test(x) && /<\/?[A-Za-z][^>]*>/.test(x.slice(1))) { const d = decodeEmbedded(x); if (d) x = d.text }
  if (x.length >= 200 && B64_RUN.test(x)) { B64_RUN.lastIndex = 0; x = x.replace(B64_RUN, (m) => { if (!mixed(m)) return m; const buf = Buffer.from(m.slice(0, m.length - (m.length % 4)), 'base64'); const head = buf.subarray(0, 200).toString('latin1'); bump(/^\s*</.test(head) && /compression\s*=/.test(head) ? '压缩文书（未解）' : kindOfBytes(buf)); return '' }) }
  B64_RUN.lastIndex = 0
  return x
}

/** 一个取值 → 清洗后的文字（可能为空串） */
export function cleanValue(v, stats = null) {
  if (v == null) return ''
  let s = String(v)
  if (s.length >= 64 || s.includes('<') || s.includes('{\\rtf')) s = stripMedia(s, stats)
  if (s.includes('@') && JAVA_OBJ.test(s)) {
    JAVA_OBJ.lastIndex = 0
    s = s.replace(JAVA_OBJ, '').replace(JAVA_TAIL, '').replace(JAVA_HEAD, '').replace(/\\n/g, '\n').replace(/\\"/g, '"')
    if (stats) stats.garbled = (stats.garbled ?? 0) + 1
  }
  JAVA_OBJ.lastIndex = 0
  const d = decodeShortBase64(s)
  if (d != null) { s = d; if (stats) stats.decoded = (stats.decoded ?? 0) + 1 }
  return s
}

/** 取值是不是占位（不算内容）：空、null、纯标点（-、/、—）。数字不算占位（"血压：130/80" 有用） */
export function isPlaceholder(v) {
  const s = String(v ?? '').trim()
  if (!s) return true
  if (/^(?:null|undefined|none|n\/a|nan)$/i.test(s)) return true
  return /^[\s\p{P}\p{S}]+$/u.test(s)
}

/** 文书是不是空壳：各栏目内容（不含栏目名）里的汉字不到 2 个 */
export function isHollow(doc) {
  const parts = doc.sections?.length ? doc.sections.map((x) => doc.text.slice(x.s, x.e)) : [doc.text]
  let n = 0
  for (const p of parts) { n += p.match(CJK)?.length ?? 0; if (n >= 2) return false }
  return true
}
