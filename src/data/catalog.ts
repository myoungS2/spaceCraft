import { z } from 'zod'
import { FurnitureShapeSchema, type CustomFurniture, type FurnitureShape } from '../model/schema'
import raw from './catalog.json'

export const CatalogEntrySchema = z.object({
  id: z.string().min(1),
  category: z.string(),
  name: z.string(),
  width: z.number().int().positive(),
  depth: z.number().int().positive(),
  height: z.number().int().positive(),
  /** 윗면 모양(원형 식탁 등). 없으면 사각 */
  shape: FurnitureShapeSchema.optional(),
  /** public/models/ 아래 GLB 경로(예: "/models/sofa.glb"). 없으면 박스로 대체 렌더 */
  modelUrl: z.string().optional(),
  license: z.string(),
  author: z.string(),
  sourceUrl: z.string(),
})

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>

/** 잘못된 카탈로그는 개발 중 바로 드러나도록 import 시점에 검증한다. */
export const catalog: CatalogEntry[] = z.array(CatalogEntrySchema).parse(raw)

export const catalogById = new Map(catalog.map((e) => [e.id, e]))

/** 문서의 사용자 가구 종류(doc.customCatalog)를 카탈로그 항목 모양으로 바꾼다. */
export const customToEntry = (c: CustomFurniture): CatalogEntry => ({ ...c, license: '', author: '사용자', sourceUrl: '' })

/** 기본 카탈로그 + 사용자 가구 종류 */
export const fullCatalog = (custom: readonly CustomFurniture[]): CatalogEntry[] => [...catalog, ...custom.map(customToEntry)]

export const catalogCategories = (entries: readonly CatalogEntry[]): string[] => [...new Set(entries.map((e) => e.category))]

/**
 * id로 카탈로그 항목을 찾는다(기본 → 사용자 순).
 * 카탈로그에서 사라진 가구도 그릴 수 있도록 못 찾으면 대체 항목을 돌려준다.
 */
export function catalogEntry(id: string, custom: readonly CustomFurniture[] = []): CatalogEntry {
  const own = catalogById.get(id)
  if (own) return own
  const mine = custom.find((c) => c.id === id)
  if (mine) return customToEntry(mine)
  return {
    id,
    category: '기타',
    name: '알 수 없는 가구',
    width: 500,
    depth: 500,
    height: 500,
    license: '',
    author: '',
    sourceUrl: '',
  }
}

export const entryShape = (e: Pick<CatalogEntry, 'shape'>): FurnitureShape => e.shape ?? 'box'

/** 드래그앤드롭으로 카탈로그 id를 넘길 때 쓰는 MIME 타입 */
export const CATALOG_DRAG_TYPE = 'application/x-spacecraft-catalog'
