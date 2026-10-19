import { newId } from './ids'
import type { CustomFurniture, Doc, FurnitureShape } from './schema'

export interface CustomFurnitureInput {
  name: string
  category: string
  width: number
  depth: number
  height: number
  shape?: FurnitureShape
}

/** 입력을 정리해 새 항목을 만든다. 이름·카테고리가 비었거나 치수가 양의 정수 mm가 아니면 오류 메시지. */
export function createCustomFurniture(input: CustomFurnitureInput): { ok: true; entry: CustomFurniture } | { ok: false; error: string } {
  const name = input.name.trim()
  const category = input.category.trim()
  if (!name) return { ok: false, error: '이름을 입력하세요.' }
  if (!category) return { ok: false, error: '카테고리를 입력하세요.' }
  const dims = [input.width, input.depth, input.height].map((v) => Math.round(v))
  if (dims.some((v) => !Number.isFinite(v) || v <= 0)) return { ok: false, error: '치수는 0보다 큰 mm로 입력하세요.' }
  const [width, depth, height] = dims as [number, number, number]
  const entry: CustomFurniture = { id: newId('f'), name, category, width, depth, height }
  if (input.shape === 'round') entry.shape = 'round'
  return { ok: true, entry }
}

/** 이 종류를 쓰는 가구가 문서에 있는지 */
export const isCustomFurnitureInUse = (doc: Doc, id: string): boolean =>
  doc.floors.some((f) => f.items.some((i) => i.catalogId === id))

/** 쓰이지 않는 항목만 지운다. 쓰이고 있거나 없으면 같은 목록을 돌려준다. */
export function removeCustomFurniture(list: CustomFurniture[], doc: Doc, id: string): CustomFurniture[] {
  if (!list.some((e) => e.id === id) || isCustomFurnitureInUse(doc, id)) return list
  return list.filter((e) => e.id !== id)
}
