import { parseDoc, type ParseResult } from './migrate'
import type { Doc } from './schema'

/** 내보내기 파일 내용. 사람이 읽고 diff 하기 쉽도록 들여쓰기한다. */
export const serializeDoc = (doc: Doc): string => `${JSON.stringify(doc, null, 2)}\n`

/** 예: roomie-20261018-2130.json (로컬 시간) */
export function exportFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`
  return `roomie-${stamp}.json`
}

/** 불러온 파일 텍스트 → JSON 파싱 → migrate → zod 검증. 예외를 던지지 않는다. */
export function deserializeDoc(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON 형식이 아닙니다.' }
  }
  return parseDoc(raw)
}
