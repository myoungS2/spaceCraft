import { z } from 'zod'
import raw from './catalog.json'

export const CatalogEntrySchema = z.object({
  id: z.string().min(1),
  category: z.string(),
  name: z.string(),
  width: z.number().int().positive(),
  depth: z.number().int().positive(),
  height: z.number().int().positive(),
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

export const catalogCategories = [...new Set(catalog.map((e) => e.category))]

/** 카탈로그에서 사라진 가구도 그릴 수 있도록 대체 항목을 돌려준다. */
export function catalogEntry(id: string): CatalogEntry {
  return (
    catalogById.get(id) ?? {
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
  )
}

/** 드래그앤드롭으로 카탈로그 id를 넘길 때 쓰는 MIME 타입 */
export const CATALOG_DRAG_TYPE = 'application/x-spacecraft-catalog'
