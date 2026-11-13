/**
 * 日期文本 → { date: 'YYYY[-MM[-DD]]', precision: 'year'|'month'|'day' }。
 * 绝对："2019年3月""2019-03-05""2019.3"；相对（按文书写成日换算）："2年前""3月余前""半年前""去年"。
 */
import { addDaysDay, addMonthsDay, pad } from '../util.js'

const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5 }
export function cnNumber(s) {
  if (s == null) return null
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s)
  if (s === '半') return 0.5
  if (s === '十') return 10
  let m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/)
  if (m) return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0)
  if (s.length === 1 && CN[s] != null) return CN[s]
  m = s.match(/^([一二两三四五六七八九十\d]+)个?半$/)
  if (m) return (cnNumber(m[1]) ?? 0) + 0.5
  return null
}

export function parseDateText(raw, writtenDay = null) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let m = s.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*日?/)
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return { date: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`, precision: 'day' }
  m = s.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*月?/)
  if (m && +m[2] >= 1 && +m[2] <= 12) return { date: `${m[1]}-${pad(+m[2])}`, precision: 'month' }
  m = s.match(/(\d{4})\s*年/)
  if (m) return { date: m[1], precision: 'year' }
  if (!writtenDay) return null
  const w = writtenDay.slice(0, 10)
  if (/去年/.test(s)) return { date: String(+w.slice(0, 4) - 1), precision: 'year' }
  if (/前年/.test(s)) return { date: String(+w.slice(0, 4) - 2), precision: 'year' }
  if (/今年/.test(s)) return { date: w.slice(0, 4), precision: 'year' }
  // "3年前""半年余前"；整段只是时长（主诉里的"情绪低落3月"）也按写成日往前推
  m = s.match(/([\d.]+|[一二两三四五六七八九十半]+|[一二两三四五六七八九十\d]+个?半)\s*(?:个)?\s*(年|月|周|星期|天|日)\s*(?:余|多|左右|许)?\s*(前|之前|以前)?/)
  if (!m || (!m[3] && !/^[\d.一二两三四五六七八九十半个]+\s*(?:年|月|周|星期|天|日)\s*(?:余|多|左右|许)?$/.test(s))) return null
  const n = cnNumber(m[1].replace(/个$/, ''))
  if (n == null) return null
  switch (m[2]) {
    case '年': return n >= 1 && Number.isInteger(n) ? { date: addMonthsDay(w, -12 * n).slice(0, 7), precision: 'month' } : { date: addMonthsDay(w, -Math.round(12 * n)).slice(0, 7), precision: 'month' }
    case '月': return { date: addMonthsDay(w, -Math.round(n)).slice(0, 7), precision: 'month' }
    case '周': case '星期': return { date: addDaysDay(w, -Math.round(7 * n)), precision: 'day' }
    default: return { date: addDaysDay(w, -Math.round(n)), precision: 'day' }
  }
}

/** Accept a model-given date value: YYYY, YYYY-MM, YYYY-MM-DD. */
export function normalizeDateValue(v) {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return { date: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`, precision: 'day' }
  m = s.match(/^(\d{4})-(\d{1,2})$/)
  if (m && +m[2] >= 1 && +m[2] <= 12) return { date: `${m[1]}-${pad(+m[2])}`, precision: 'month' }
  if (/^\d{4}$/.test(s)) return { date: s, precision: 'year' }
  return parseDateText(s)
}
