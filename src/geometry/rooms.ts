import { newId } from '../model/ids'
import type { Corner, Floor, Room } from '../model/schema'
import type { Vec } from './vec'

/** 이보다 작은 면(mm²)은 방으로 보지 않는다. 0.01m² */
const MIN_ROOM_AREA = 10_000

export const ROOM_COLORS = ['#efe4d0', '#dde8f2', '#e2ecdc', '#f2e0e0', '#e7e1f2', '#f4eed8']

/** y-down 좌표에서 신발끈 공식. 화면에서 시계 방향이면 양수. */
export function signedArea(points: readonly Vec[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

/** 면적(m², 소수 1자리) */
export const areaM2 = (points: readonly Vec[]): number => Math.round(Math.abs(signedArea(points)) / 100_000) / 10

/** 다각형 무게중심. 면적이 0이면 꼭짓점 평균. (오목한 방은 바깥에 찍힐 수 있다) */
export function centroid(points: readonly Vec[]): Vec {
  const a = signedArea(points)
  if (Math.abs(a) < 1e-9) {
    const n = points.length || 1
    return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n }
  }
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    const q = points[(i + 1) % points.length]!
    const cross = p.x * q.y - q.x * p.y
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

export function pointInPolygon(p: Vec, poly: readonly Vec[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function roomPolygon(room: Room, corners: ReadonlyMap<string, Corner>): Vec[] {
  return room.cornerIds.map((id) => corners.get(id)).filter((c): c is Corner => c !== undefined)
}

/**
 * 벽 그래프에서 닫힌 영역(face)을 corner id 배열로 찾는다.
 * 1) 끝이 열린 벽(차수 1 꼭짓점)을 반복해서 걷어내고
 * 2) 각 꼭짓점의 이웃을 각도순으로 정렬한 뒤, 모든 반-변(half-edge)에서 출발해
 *    "들어온 방향을 뒤집은 다음 각도의 이웃"으로 이어가며 면을 순회한다.
 * 이 규칙에서 바깥 경계는 양의 면적(화면 시계 방향), 안쪽 방은 음의 면적이 된다.
 */
export function detectFaces(floor: Floor): string[][] {
  const corners = new Map(floor.corners.map((c) => [c.id, c]))
  const adj = new Map<string, Set<string>>()
  for (const w of floor.walls) {
    if (w.start === w.end || !corners.has(w.start) || !corners.has(w.end)) continue
    if (!adj.has(w.start)) adj.set(w.start, new Set())
    if (!adj.has(w.end)) adj.set(w.end, new Set())
    adj.get(w.start)!.add(w.end)
    adj.get(w.end)!.add(w.start)
  }

  // 끝이 열린 벽 걷어내기
  const queue = [...adj.keys()].filter((id) => adj.get(id)!.size <= 1)
  while (queue.length) {
    const id = queue.pop()!
    const ns = adj.get(id)
    if (!ns) continue
    adj.delete(id)
    for (const n of ns) {
      const nn = adj.get(n)
      if (!nn) continue
      nn.delete(id)
      if (nn.size <= 1) queue.push(n)
    }
  }

  const sorted = new Map<string, string[]>()
  for (const [id, ns] of adj) {
    const c = corners.get(id)!
    sorted.set(
      id,
      [...ns].sort((a, b) => {
        const ca = corners.get(a)!
        const cb = corners.get(b)!
        return Math.atan2(ca.y - c.y, ca.x - c.x) - Math.atan2(cb.y - c.y, cb.x - c.x)
      }),
    )
  }

  const visited = new Set<string>()
  const faces: string[][] = []
  for (const [u, ns] of sorted) {
    for (const v of ns) {
      if (visited.has(`${u}>${v}`)) continue
      const face: string[] = []
      let a = u
      let b = v
      // 변 개수만큼이면 반드시 닫힌다. 안전장치로 상한을 둔다.
      for (let guard = 0; guard <= floor.walls.length * 2 + 1; guard++) {
        visited.add(`${a}>${b}`)
        face.push(a)
        const around = sorted.get(b)!
        const next = around[(around.indexOf(a) + 1) % around.length]!
        a = b
        b = next
        if (a === u && b === v) break
      }
      const pts = face.map((id) => corners.get(id)!)
      if (signedArea(pts) < -MIN_ROOM_AREA / 2) faces.push(face) // 안쪽 면만(음수)
    }
  }
  return faces
}

const sharedCount = (a: readonly string[], b: ReadonlySet<string>) => a.reduce((n, id) => n + (b.has(id) ? 1 : 0), 0)

/**
 * 감지한 면을 기존 rooms와 맞춰 이름·색을 유지한다.
 * 1) corner 집합이 정확히 같으면 그대로 이어받는다.
 * 2) 남은 것끼리는 공유 corner가 3개 이상이거나, 2개 이상이면서 두 다각형이 실제로 겹칠 때(한쪽 무게중심이
 *    다른 쪽 안) 이어받는다. 공유 corner가 많고 면적이 큰 순으로 정한다(벽 분할로 꼭짓점이 늘거나 방이 나뉜 경우).
 * 3) 그래도 남은 면은 새 방이 된다.
 */
export function matchRooms(prev: readonly Room[], faces: readonly string[][], corners: ReadonlyMap<string, Corner>): Room[] {
  const keyOf = (ids: readonly string[]) => [...ids].sort().join('|')
  const prevByKey = new Map(prev.map((r) => [keyOf(r.cornerIds), r]))
  const result: (Room | undefined)[] = faces.map(() => undefined)
  const used = new Set<string>()
  const polyOf = (ids: readonly string[]) => ids.map((id) => corners.get(id)).filter((c): c is Corner => !!c)

  faces.forEach((face, i) => {
    const r = prevByKey.get(keyOf(face))
    if (r && !used.has(r.id)) {
      used.add(r.id)
      result[i] = { ...r, cornerIds: face }
    }
  })

  const candidates: { i: number; room: Room; shared: number; area: number }[] = []
  faces.forEach((face, i) => {
    if (result[i]) return
    const facePoly = polyOf(face)
    const area = Math.abs(signedArea(facePoly))
    for (const room of prev) {
      if (used.has(room.id)) continue
      const shared = sharedCount(room.cornerIds, new Set(face))
      if (shared < 2) continue
      const roomPoly = polyOf(room.cornerIds)
      const overlaps =
        roomPoly.length >= 3 &&
        (pointInPolygon(centroid(facePoly), roomPoly) || pointInPolygon(centroid(roomPoly), facePoly))
      if (shared >= 3 || overlaps) candidates.push({ i, room, shared, area })
    }
  })
  candidates.sort((a, b) => b.shared - a.shared || b.area - a.area)
  for (const { i, room } of candidates) {
    if (result[i] || used.has(room.id)) continue
    used.add(room.id)
    result[i] = { ...room, cornerIds: faces[i]! }
  }

  const names = new Set(result.filter(Boolean).map((r) => r!.name))
  let n = 1
  let color = prev.length
  return faces.map((face, i) => {
    const kept = result[i]
    if (kept) return kept
    while (names.has(`방 ${n}`)) n++
    const name = `방 ${n}`
    names.add(name)
    return { id: newId('r'), name, cornerIds: face, floorColor: ROOM_COLORS[color++ % ROOM_COLORS.length]! }
  })
}

/** 벽 연결 구조(어떤 corner끼리 이어졌는지)를 나타내는 키. 위치만 바뀌면 같다. */
export function topologyKey(floor: Floor): string {
  return floor.walls
    .map((w) => (w.start < w.end ? `${w.start}|${w.end}` : `${w.end}|${w.start}`))
    .sort()
    .join(',')
}

/** 벽 구조가 바뀌었으면 rooms를 다시 계산한다. 그대로면 같은 floor를 돌려준다. */
export function syncRooms(prev: Floor, next: Floor): Floor {
  if (prev !== next && topologyKey(prev) === topologyKey(next) && prev.rooms === next.rooms) return next
  const rooms = matchRooms(next.rooms, detectFaces(next), new Map(next.corners.map((c) => [c.id, c])))
  const same =
    rooms.length === next.rooms.length &&
    rooms.every((r, i) => {
      const old = next.rooms[i]!
      return r.id === old.id && r.cornerIds.join('|') === old.cornerIds.join('|')
    })
  return same ? next : { ...next, rooms }
}
