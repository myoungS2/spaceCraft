import { DocSchema, SCHEMA_VERSION, type Doc } from './schema'

export type ParseResult =
  | { ok: true; doc: Doc }
  | { ok: false; error: string }

/**
 * 버전별 변환 단계. key 버전의 문서를 key+1 버전으로 바꾼다.
 * 예: schemaVersion 2를 만들면 `1: (d) => ({ ...d, schemaVersion: 2, ... })` 추가.
 */
const steps: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // v2: 사용자 가구 종류(customCatalog) 추가
  1: (d) => ({ ...d, schemaVersion: 2, customCatalog: [] }),
}

/** 알 수 없는 입력을 최신 버전 문서로 올린 뒤 zod로 검증한다. 예외를 던지지 않는다. */
export function parseDoc(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: '문서가 객체가 아닙니다.' }
  }
  let current = raw as Record<string, unknown>
  let version = current.schemaVersion
  if (typeof version !== 'number') {
    return { ok: false, error: 'schemaVersion이 없습니다.' }
  }
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: `더 최신 버전(v${version})의 문서입니다. 앱을 업데이트하세요.` }
  }
  while (version < SCHEMA_VERSION) {
    const step = steps[version]
    if (!step) return { ok: false, error: `v${version} → v${version + 1} 변환 단계가 없습니다.` }
    current = step(current)
    version += 1
  }

  const result = DocSchema.safeParse(current)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.join('.') || '(root)'
    return { ok: false, error: `문서 형식 오류: ${where} — ${issue?.message ?? '알 수 없음'}` }
  }
  return { ok: true, doc: result.data }
}
