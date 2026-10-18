import { newId } from '../model/ids'
import type { Corner, Floor, Wall } from '../model/schema'
import { add, distance, normalize, projectOnSegment, roundVec, scale, sub, type Vec } from './vec'

/** 벽 위에 점이 "놓였다"고 보는 거리(mm). 분할 대상 벽을 다시 찾을 때 쓴다. */
const ON_WALL_EPS = 1

/** 그리기 도구가 넘기는 점. 스냅 결과에 따라 기존 corner/벽을 가리킬 수 있다. */
export interface PointRef extends Vec {
  cornerId?: string
  wallId?: string
}

export interface WallSegment {
  wall: Wall
  a: Corner
  b: Corner
}

export function cornerMap(floor: Floor): Map<string, Corner> {
  return new Map(floor.corners.map((c) => [c.id, c]))
}

/** 양 끝 corner를 찾을 수 있는 벽만 선분으로 돌려준다. */
export function wallSegments(floor: Floor): WallSegment[] {
  const corners = cornerMap(floor)
  const out: WallSegment[] = []
  for (const wall of floor.walls) {
    const a = corners.get(wall.start)
    const b = corners.get(wall.end)
    if (a && b) out.push({ wall, a, b })
  }
  return out
}

export function getSegment(floor: Floor, wallId: string): WallSegment | undefined {
  const wall = floor.walls.find((w) => w.id === wallId)
  if (!wall) return undefined
  const a = floor.corners.find((c) => c.id === wall.start)
  const b = floor.corners.find((c) => c.id === wall.end)
  return a && b ? { wall, a, b } : undefined
}

export const segmentLength = (s: WallSegment): number => distance(s.a, s.b)

export function wallLength(floor: Floor, wallId: string): number {
  const s = getSegment(floor, wallId)
  return s ? Math.round(segmentLength(s)) : 0
}

const hasWallBetween = (floor: Floor, a: string, b: string) =>
  floor.walls.some((w) => (w.start === a && w.end === b) || (w.start === b && w.end === a))

/**
 * 벽을 point 지점에서 둘로 나눈다(T자 접합). 개구부는 중심 위치 기준으로 앞/뒤 벽에 다시 배분한다.
 * 분할 지점이 끝점과 같으면 그 끝점 corner를 돌려준다.
 */
export function splitWall(floor: Floor, wallId: string, point: Vec): { floor: Floor; cornerId: string } {
  const seg = getSegment(floor, wallId)
  if (!seg) throw new Error(`splitWall: 벽 ${wallId} 없음`)
  const { wall, a, b } = seg
  const proj = projectOnSegment(point, a, b)
  const at = roundVec(proj.point)
  if (at.x === a.x && at.y === a.y) return { floor, cornerId: a.id }
  if (at.x === b.x && at.y === b.y) return { floor, cornerId: b.id }

  const splitDist = distance(a, at)
  const corner: Corner = { id: newId('c'), ...at }
  const first: Wall = {
    ...wall,
    end: corner.id,
    openings: wall.openings.filter((o) => o.offset < splitDist),
  }
  const second: Wall = {
    ...wall,
    id: newId('w'),
    start: corner.id,
    openings: wall.openings
      .filter((o) => o.offset >= splitDist)
      .map((o) => ({ ...o, offset: Math.round(o.offset - splitDist) })),
  }
  const walls = floor.walls.flatMap((w) => (w.id === wallId ? [first, second] : [w]))
  return { floor: { ...floor, corners: [...floor.corners, corner], walls }, cornerId: corner.id }
}

/**
 * 점 p를 내부에 지나는 벽을 찾는다. 가리키던 벽이 이미 분할돼 조각이 바뀌었을 수 있으므로
 * preferredId라도 실제로 점을 지나는지 확인하고, 아니면 다른 벽을 찾는다.
 */
function findWallThrough(floor: Floor, p: Vec, preferredId?: string): string | undefined {
  const passes = (s: WallSegment) => {
    const proj = projectOnSegment(p, s.a, s.b)
    return proj.distance <= ON_WALL_EPS && proj.t > 0 && proj.t < 1
  }
  const segments = wallSegments(floor)
  const preferred = segments.find((s) => s.wall.id === preferredId)
  if (preferred && passes(preferred)) return preferred.wall.id
  return segments.find(passes)?.wall.id
}

/** PointRef를 실제 corner id로 확정한다. 필요하면 벽을 분할하거나 corner를 새로 만든다. */
export function resolvePoint(floor: Floor, ref: PointRef): { floor: Floor; cornerId: string } {
  if (ref.cornerId && floor.corners.some((c) => c.id === ref.cornerId)) {
    return { floor, cornerId: ref.cornerId }
  }
  const p = roundVec(ref)
  const same = floor.corners.find((c) => c.x === p.x && c.y === p.y)
  if (same) return { floor, cornerId: same.id }
  // 스냅이 벽을 알려주지 않았더라도 점이 벽 위에 있으면 분할해서 연결한다.
  const wallId = findWallThrough(floor, p, ref.wallId)
  if (wallId) return splitWall(floor, wallId, p)
  const corner: Corner = { id: newId('c'), ...p }
  return { floor: { ...floor, corners: [...floor.corners, corner] }, cornerId: corner.id }
}

/**
 * a → b 벽을 추가한다. 길이가 0이거나 같은 두 corner 사이에 이미 벽이 있으면 벽은 만들지 않는다.
 * 어느 경우든 확정된 양 끝 corner id를 돌려준다(연속 그리기의 다음 시작점).
 */
export function addWall(
  floor: Floor,
  a: PointRef,
  b: PointRef,
  thickness: number,
): { floor: Floor; startId: string; endId: string; wallId?: string } {
  const ra = resolvePoint(floor, a)
  const rb = resolvePoint(ra.floor, b)
  const f = rb.floor
  if (ra.cornerId === rb.cornerId || hasWallBetween(f, ra.cornerId, rb.cornerId)) {
    return { floor: f, startId: ra.cornerId, endId: rb.cornerId }
  }
  const wall: Wall = { id: newId('w'), start: ra.cornerId, end: rb.cornerId, thickness, openings: [] }
  return { floor: { ...f, walls: [...f.walls, wall] }, startId: ra.cornerId, endId: rb.cornerId, wallId: wall.id }
}

/** 어떤 벽에서도 쓰이지 않는 corner를 지운다. */
export function removeOrphanCorners(floor: Floor): Floor {
  const used = new Set(floor.walls.flatMap((w) => [w.start, w.end]))
  const corners = floor.corners.filter((c) => used.has(c.id))
  return corners.length === floor.corners.length ? floor : { ...floor, corners }
}

export function deleteWall(floor: Floor, wallId: string): Floor {
  if (!floor.walls.some((w) => w.id === wallId)) return floor
  return removeOrphanCorners({ ...floor, walls: floor.walls.filter((w) => w.id !== wallId) })
}

/** corner와 거기 연결된 벽을 모두 지운다. */
export function deleteCorner(floor: Floor, cornerId: string): Floor {
  if (!floor.corners.some((c) => c.id === cornerId)) return floor
  const walls = floor.walls.filter((w) => w.start !== cornerId && w.end !== cornerId)
  return removeOrphanCorners({ ...floor, walls, corners: floor.corners.filter((c) => c.id !== cornerId) })
}

/** 여러 corner를 한 번에 옮긴다. 값이 그대로면 같은 floor를 돌려준다. */
export function moveCorners(floor: Floor, positions: ReadonlyMap<string, Vec>): Floor {
  let changed = false
  const corners = floor.corners.map((c) => {
    const p = positions.get(c.id)
    if (!p) return c
    const r = roundVec(p)
    if (r.x === c.x && r.y === c.y) return c
    changed = true
    return { ...c, ...r }
  })
  if (!changed) return floor
  // 3D가 바뀐 벽만 다시 만들 수 있도록, 움직인 corner에 연결된 벽은 새 객체로 교체한다.
  const moved = new Set(corners.filter((c, i) => c !== floor.corners[i]).map((c) => c.id))
  const walls = floor.walls.map((w) => (moved.has(w.start) || moved.has(w.end) ? { ...w } : w))
  return { ...floor, corners, walls }
}

export const moveCorner = (floor: Floor, cornerId: string, p: Vec): Floor =>
  moveCorners(floor, new Map([[cornerId, p]]))

/**
 * from corner를 into corner에 합친다(꼭짓점을 다른 꼭짓점 위에 놓았을 때).
 * from을 쓰던 벽은 into를 가리키게 되고, 길이 0이 되거나 중복되는 벽은 지운다.
 */
export function mergeCorners(floor: Floor, fromId: string, intoId: string): Floor {
  if (fromId === intoId) return floor
  if (!floor.corners.some((c) => c.id === fromId) || !floor.corners.some((c) => c.id === intoId)) return floor
  const seen = new Set<string>()
  const walls: Wall[] = []
  for (const w of floor.walls) {
    const start = w.start === fromId ? intoId : w.start
    const end = w.end === fromId ? intoId : w.end
    if (start === end) continue
    const key = start < end ? `${start}|${end}` : `${end}|${start}`
    if (seen.has(key)) continue
    seen.add(key)
    walls.push(start === w.start && end === w.end ? w : { ...w, start, end })
  }
  return removeOrphanCorners({ ...floor, walls, corners: floor.corners.filter((c) => c.id !== fromId) })
}

/** 벽 길이를 바꾼다. start는 고정하고 end corner를 벽 방향으로 옮긴다. */
export function setWallLength(floor: Floor, wallId: string, newLength: number): Floor {
  const seg = getSegment(floor, wallId)
  if (!seg || newLength <= 0) return floor
  const dir = normalize(sub(seg.b, seg.a))
  if (dir.x === 0 && dir.y === 0) return floor
  return moveCorner(floor, seg.b.id, add(seg.a, scale(dir, newLength)))
}

export function updateWall(floor: Floor, wallId: string, patch: Partial<Pick<Wall, 'thickness' | 'height'>>): Floor {
  let changed = false
  const walls = floor.walls.map((w) => {
    if (w.id !== wallId) return w
    const next = { ...w, ...patch }
    if (next.thickness === w.thickness && next.height === w.height) return w
    changed = true
    return next
  })
  return changed ? { ...floor, walls } : floor
}
