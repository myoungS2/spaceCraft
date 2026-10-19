import { z } from 'zod'

/** 현재 문서 스키마 버전. 바꾸면 migrate.ts에 변환 단계를 추가한다. */
export const SCHEMA_VERSION = 2

/** 길이는 모두 정수 mm */
const mm = z.number().int()
const positiveMm = mm.positive()
const id = z.string().min(1)

export const CornerSchema = z.object({
  id,
  x: mm,
  y: mm,
})

export const OpeningSchema = z.object({
  id,
  type: z.enum(['door', 'window']),
  /** 벽 start corner부터 개구부 중심까지의 거리(벽 중심선 기준) */
  offset: mm.nonnegative(),
  width: positiveMm,
  height: positiveMm,
  /** 바닥에서 개구부 하단까지의 높이. door는 항상 0 */
  sill: mm.nonnegative(),
  /** door: 경첩을 벽 end 쪽에 둔다(기본은 start 쪽) */
  hingeAtEnd: z.boolean().optional(),
  /** door: 벽의 반대쪽으로 열린다 */
  swingReverse: z.boolean().optional(),
})

export const WallSchema = z.object({
  id,
  start: id,
  end: id,
  thickness: positiveMm,
  /** 없으면 floor.height 사용 */
  height: positiveMm.optional(),
  openings: z.array(OpeningSchema),
})

export const RoomSchema = z.object({
  id,
  name: z.string(),
  cornerIds: z.array(id).min(3),
  floorColor: z.string(),
})

export const ItemSchema = z.object({
  id,
  catalogId: id,
  /** 바운딩박스 중심 */
  x: mm,
  y: mm,
  /** degree */
  rotation: z.number(),
  /** 없으면 카탈로그 기본 치수 */
  width: positiveMm.optional(),
  depth: positiveMm.optional(),
  height: positiveMm.optional(),
  locked: z.boolean(),
})

export const FloorSchema = z.object({
  id,
  name: z.string(),
  height: positiveMm,
  corners: z.array(CornerSchema),
  walls: z.array(WallSchema),
  rooms: z.array(RoomSchema),
  items: z.array(ItemSchema),
})

/** 가구 윗면 모양. round는 폭×깊이에 내접하는 원/타원(폭≠깊이면 타원). 없으면 box. */
export const FurnitureShapeSchema = z.enum(['box', 'round'])

/** 사용자가 직접 추가한 가구 종류. 카탈로그 기본 항목과 같은 id 공간을 쓴다(item.catalogId). */
export const CustomFurnitureSchema = z.object({
  id,
  category: z.string().min(1),
  name: z.string().min(1),
  width: positiveMm,
  depth: positiveMm,
  height: positiveMm,
  shape: FurnitureShapeSchema.optional(),
})

export const SettingsSchema = z.object({
  gridSnap: positiveMm,
})

export const DocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  unit: z.literal('mm'),
  floors: z.array(FloorSchema).min(1),
  settings: SettingsSchema,
  customCatalog: z.array(CustomFurnitureSchema),
})

export type Corner = z.infer<typeof CornerSchema>
export type Opening = z.infer<typeof OpeningSchema>
export type OpeningType = Opening['type']
export type Wall = z.infer<typeof WallSchema>
export type Room = z.infer<typeof RoomSchema>
export type Item = z.infer<typeof ItemSchema>
export type Floor = z.infer<typeof FloorSchema>
export type FurnitureShape = z.infer<typeof FurnitureShapeSchema>
export type CustomFurniture = z.infer<typeof CustomFurnitureSchema>
export type Settings = z.infer<typeof SettingsSchema>
export type Doc = z.infer<typeof DocSchema>
