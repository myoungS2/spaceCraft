import { newId } from '../model/ids'
import type { Floor, Item } from '../model/schema'
import type { Vec } from './vec'

export const ROTATION_SNAP = 15
/** 복제할 때 원본에서 비켜 놓는 거리(mm) */
export const DUPLICATE_OFFSET = 300

export interface Dims {
  width: number
  depth: number
  height: number
}

/** 카탈로그 기본 치수에 아이템의 치수 오버라이드를 덮는다. */
export const itemDims = (item: Item, base: Dims): Dims => ({
  width: item.width ?? base.width,
  depth: item.depth ?? base.depth,
  height: item.height ?? base.height,
})

/** 0 ≤ deg < 360 */
export const normalizeAngle = (deg: number): number => ((deg % 360) + 360) % 360

export const snapAngle = (deg: number, step = ROTATION_SNAP): number => normalizeAngle(Math.round(deg / step) * step)

/** 회전된 바운딩박스 꼭짓점(화면 y-down, 시계 방향 회전) */
export function itemCorners(item: Pick<Item, 'x' | 'y' | 'rotation'>, dims: Pick<Dims, 'width' | 'depth'>): Vec[] {
  const r = (item.rotation * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const hw = dims.width / 2
  const hd = dims.depth / 2
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, ly]) => ({ x: item.x + lx! * cos - ly! * sin, y: item.y + lx! * sin + ly! * cos }))
}

const mapItem = (floor: Floor, id: string, fn: (item: Item) => Item): Floor => {
  let changed = false
  const items = floor.items.map((it) => {
    if (it.id !== id) return it
    const next = fn(it)
    if (next !== it) changed = true
    return next
  })
  return changed ? { ...floor, items } : floor
}

export function addItem(floor: Floor, catalogId: string, at: Vec, rotation = 0): { floor: Floor; itemId: string } {
  const item: Item = {
    id: newId('i'),
    catalogId,
    x: Math.round(at.x),
    y: Math.round(at.y),
    rotation: normalizeAngle(rotation),
    locked: false,
  }
  return { floor: { ...floor, items: [...floor.items, item] }, itemId: item.id }
}

/** 잠긴 가구는 움직이지 않는다. */
export function moveItem(floor: Floor, id: string, at: Vec): Floor {
  const x = Math.round(at.x)
  const y = Math.round(at.y)
  return mapItem(floor, id, (it) => (it.locked || (it.x === x && it.y === y) ? it : { ...it, x, y }))
}

/** 절대 각도로 회전. 잠긴 가구는 그대로. */
export function rotateItemTo(floor: Floor, id: string, deg: number): Floor {
  const rotation = normalizeAngle(deg)
  return mapItem(floor, id, (it) => (it.locked || it.rotation === rotation ? it : { ...it, rotation }))
}

/**
 * 중심 center를 축으로 포인터가 from → to로 움직인 만큼 start에서 돌린 각도(step° 스냅).
 * 평면(y-down) 각도이므로 화면에서 시계 방향이 +로, item.rotation과 같은 방향이다.
 */
export function rotationByDrag(start: number, center: Vec, from: Vec, to: Vec, step = ROTATION_SNAP): number {
  const angle = (p: Vec) => (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI
  return snapAngle(start + angle(to) - angle(from), step)
}

/** 현재 각도에서 step만큼 돌리고 15° 격자에 맞춘다. */
export function rotateItemBy(floor: Floor, id: string, step: number): Floor {
  const it = floor.items.find((i) => i.id === id)
  return it ? rotateItemTo(floor, id, snapAngle(it.rotation + step)) : floor
}

export function duplicateItem(floor: Floor, id: string): { floor: Floor; itemId?: string } {
  const src = floor.items.find((i) => i.id === id)
  if (!src) return { floor }
  const copy: Item = { ...src, id: newId('i'), x: src.x + DUPLICATE_OFFSET, y: src.y + DUPLICATE_OFFSET, locked: false }
  return { floor: { ...floor, items: [...floor.items, copy] }, itemId: copy.id }
}

export type ItemPatch = Partial<Omit<Item, 'id' | 'catalogId'>>

/** 속성 패널용. 잠겨 있으면 잠금 해제 외의 변경은 무시한다. */
export function updateItem(floor: Floor, id: string, patch: ItemPatch): Floor {
  return mapItem(floor, id, (it) => {
    const allowed: ItemPatch = it.locked ? (patch.locked === undefined ? {} : { locked: patch.locked }) : patch
    const next: Item = { ...it, ...allowed }
    if (allowed.x !== undefined) next.x = Math.round(allowed.x)
    if (allowed.y !== undefined) next.y = Math.round(allowed.y)
    if (allowed.rotation !== undefined) next.rotation = normalizeAngle(allowed.rotation)
    const keys = new Set([...Object.keys(it), ...Object.keys(next)]) as Set<keyof Item>
    return [...keys].every((k) => it[k] === next[k]) ? it : next
  })
}

/** 치수 오버라이드를 지워 카탈로그 기본값으로 되돌린다. */
export function resetItemDims(floor: Floor, id: string): Floor {
  return mapItem(floor, id, (it) => {
    if (it.locked || (it.width === undefined && it.depth === undefined && it.height === undefined)) return it
    const { width: _w, depth: _d, height: _h, ...rest } = it
    return rest
  })
}

export function deleteItem(floor: Floor, id: string): Floor {
  return floor.items.some((i) => i.id === id) ? { ...floor, items: floor.items.filter((i) => i.id !== id) } : floor
}
