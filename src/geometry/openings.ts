import { newId } from '../model/ids'
import type { Floor, Opening, OpeningType, Wall } from '../model/schema'
import { getSegment, segmentLength } from './walls'

export const OPENING_DEFAULTS: Record<OpeningType, Pick<Opening, 'width' | 'height' | 'sill'>> = {
  door: { width: 900, height: 2100, sill: 0 },
  window: { width: 1200, height: 1200, sill: 900 },
}

/** 개구부 폭의 최소값(mm) */
export const MIN_OPENING_WIDTH = 100

interface Span {
  id?: string
  offset: number
  width: number
}

const overlaps = (a: Span, b: Span) => Math.abs(a.offset - b.offset) < (a.width + b.width) / 2

/**
 * 길이 wallLength인 벽에 폭 width의 개구부를 desired 근처에 놓을 수 있는 중심 위치를 찾는다.
 * - 벽 양 끝을 벗어나지 않게 클램프한다.
 * - 같은 벽의 다른 개구부(self 제외)와 겹치면 가장 가까운 빈 자리로 민다.
 * 놓을 자리가 없으면 null.
 */
export function placeOpening(
  wallLength: number,
  others: readonly Span[],
  self: Pick<Span, 'id' | 'width'>,
  desired: number,
): number | null {
  const half = self.width / 2
  if (self.width > wallLength) return null
  const min = Math.ceil(half)
  const max = Math.floor(wallLength - half)
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)))
  const rest = others.filter((o) => o.id === undefined || o.id !== self.id)

  const candidates = [clamp(desired)]
  for (const o of rest) {
    candidates.push(clamp(Math.floor(o.offset - (o.width + self.width) / 2)))
    candidates.push(clamp(Math.ceil(o.offset + (o.width + self.width) / 2)))
  }
  const valid = candidates.filter((c) => !rest.some((o) => overlaps({ offset: c, width: self.width }, o)))
  if (valid.length === 0) return null
  return valid.reduce((best, c) => (Math.abs(c - desired) < Math.abs(best - desired) ? c : best))
}

function wallLen(floor: Floor, wallId: string): number | undefined {
  const seg = getSegment(floor, wallId)
  return seg ? segmentLength(seg) : undefined
}

const mapWall = (floor: Floor, wallId: string, fn: (w: Wall) => Wall): Floor => {
  let changed = false
  const walls = floor.walls.map((w) => {
    if (w.id !== wallId) return w
    const next = fn(w)
    if (next !== w) changed = true
    return next
  })
  return changed ? { ...floor, walls } : floor
}

/** 개구부 id로 속한 벽을 찾는다(벽 분할로 소속 벽이 바뀌었을 수 있으므로 id로 찾는다). */
export function findOpening(floor: Floor, openingId: string): { wall: Wall; opening: Opening } | undefined {
  for (const wall of floor.walls) {
    const opening = wall.openings.find((o) => o.id === openingId)
    if (opening) return { wall, opening }
  }
  return undefined
}

export const wallHeight = (floor: Floor, wall: Wall): number => wall.height ?? floor.height

/** 높이·sill을 벽 높이 안으로 맞춘다. 문은 sill 0. */
function fitVertical(o: Opening, maxHeight: number): Opening {
  const sill = o.type === 'door' ? 0 : Math.min(o.sill, Math.max(0, maxHeight - 100))
  const height = Math.max(100, Math.min(o.height, maxHeight - sill))
  return sill === o.sill && height === o.height ? o : { ...o, sill, height }
}

/** 벽에 새 개구부를 추가한다. 자리가 없으면 floor 그대로, id는 undefined. */
export function addOpening(
  floor: Floor,
  wallId: string,
  type: OpeningType,
  desiredOffset: number,
): { floor: Floor; openingId?: string } {
  const len = wallLen(floor, wallId)
  const wall = floor.walls.find((w) => w.id === wallId)
  if (len === undefined || !wall) return { floor }
  const defaults = OPENING_DEFAULTS[type]
  const width = Math.min(defaults.width, Math.floor(len))
  if (width < MIN_OPENING_WIDTH) return { floor }
  const offset = placeOpening(len, wall.openings, { width }, desiredOffset)
  if (offset === null) return { floor }
  const opening = fitVertical({ id: newId('o'), type, ...defaults, width, offset }, wallHeight(floor, wall))
  return {
    floor: mapWall(floor, wallId, (w) => ({ ...w, openings: [...w.openings, opening] })),
    openingId: opening.id,
  }
}

/** 개구부를 desired 위치로 옮긴다(클램프·겹침 회피). */
export function moveOpening(floor: Floor, wallId: string, openingId: string, desiredOffset: number): Floor {
  const len = wallLen(floor, wallId)
  if (len === undefined) return floor
  return mapWall(floor, wallId, (w) => {
    const o = w.openings.find((x) => x.id === openingId)
    if (!o) return w
    const offset = placeOpening(len, w.openings, o, desiredOffset)
    if (offset === null || offset === o.offset) return w
    return { ...w, openings: w.openings.map((x) => (x.id === openingId ? { ...x, offset } : x)) }
  })
}

export type OpeningPatch = Partial<Omit<Opening, 'id'>>

/**
 * 개구부 속성을 바꾼다. 종류를 바꾸면 sill을 기본값으로 맞추고,
 * 폭이 바뀌면 자리를 다시 잡는다. 놓을 수 없으면 변경하지 않는다.
 */
export function updateOpening(floor: Floor, wallId: string, openingId: string, patch: OpeningPatch): Floor {
  const len = wallLen(floor, wallId)
  if (len === undefined) return floor
  return mapWall(floor, wallId, (w) => {
    const o = w.openings.find((x) => x.id === openingId)
    if (!o) return w
    let next: Opening = { ...o, ...patch }
    if (patch.type && patch.type !== o.type && patch.sill === undefined) {
      next.sill = OPENING_DEFAULTS[patch.type].sill
    }
    const offset = placeOpening(len, w.openings, next, next.offset)
    if (offset === null) return w
    next = fitVertical({ ...next, offset }, wallHeight(floor, w))
    const same = (Object.keys(next) as (keyof Opening)[]).every((k) => next[k] === o[k]) &&
      Object.keys(o).length === Object.keys(next).length
    if (same) return w
    return { ...w, openings: w.openings.map((x) => (x.id === openingId ? next : x)) }
  })
}

export function deleteOpening(floor: Floor, wallId: string, openingId: string): Floor {
  return mapWall(floor, wallId, (w) =>
    w.openings.some((o) => o.id === openingId) ? { ...w, openings: w.openings.filter((o) => o.id !== openingId) } : w,
  )
}

/**
 * 벽 길이·높이가 바뀌어 개구부가 벽 밖으로 나가면 안으로 되돌린다.
 * 벽보다 넓어진 개구부는 벽 길이에 맞춰 줄이고(최소 폭 미만이면 지움), 겹침은 허용한다.
 * 바뀐 것이 없으면 같은 floor를 돌려준다.
 */
export function clampOpenings(floor: Floor): Floor {
  let changed = false
  const walls = floor.walls.map((w) => {
    if (w.openings.length === 0) return w
    const seg = getSegment(floor, w.id)
    if (!seg) return w
    const len = segmentLength(seg)
    let wallChanged = false
    const openings: Opening[] = []
    for (const o of w.openings) {
      const width = Math.min(o.width, Math.floor(len))
      if (width < MIN_OPENING_WIDTH) {
        wallChanged = true
        continue
      }
      const min = Math.ceil(width / 2)
      const max = Math.floor(len - width / 2)
      const offset = Math.min(max, Math.max(min, o.offset))
      let next = width === o.width && offset === o.offset ? o : { ...o, width, offset }
      next = fitVertical(next, wallHeight(floor, w))
      if (next !== o) wallChanged = true
      openings.push(next)
    }
    if (!wallChanged) return w
    changed = true
    return { ...w, openings }
  })
  return changed ? { ...floor, walls } : floor
}
