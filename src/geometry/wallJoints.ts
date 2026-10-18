import type { WallSegment } from './walls'
import { add, distance, dot, normalize, perp, scale, sub, type Vec } from './vec'

/**
 * 바깥쪽(반사각 쪽) 마이터 끝이 corner에서 벗어날 수 있는 최대 거리. 두께의 절반 × 이 값.
 * SVG stroke-miterlimit 기본값과 같은 4 → 두 벽 사이 각이 약 29°보다 좁으면 바깥 끝을 깎는다(bevel).
 */
export const MITER_LIMIT = 4

/** 방향이 이 값(sin) 이하로 벌어지면 평행으로 보고 교점을 구하지 않는다. */
const PARALLEL_EPS = 1e-6

/**
 * 벽 하나의 위에서 본 다각형(평면 mm). 각 끝(cap)은 [prev쪽 점, corner, ..., next쪽 점] 순서이고
 * 다각형 = [...start, ...end]. start 마지막 점과 end 첫 점은 +perp 쪽 변, end 마지막 점과 start 첫 점은 -perp 쪽 변 위에 있다.
 */
export interface WallFootprint {
  start: Vec[]
  end: Vec[]
}

export const footprintPolygon = (f: WallFootprint): Vec[] => [...f.start, ...f.end]

/** corner에 붙은 벽 한쪽 끝 */
interface Arm {
  wallId: string
  /** corner에서 벽 안쪽으로 향하는 단위 벡터 */
  dir: Vec
  angle: number
  half: number
  length: number
}

/** 두 직선 p + d·s, q + e·u 의 교점에서 첫 직선의 매개변수 s, 둘째의 u. 평행이면 null. */
function intersectLines(p: Vec, d: Vec, q: Vec, e: Vec): { s: number; u: number } | null {
  const den = d.x * e.y - d.y * e.x
  if (Math.abs(den) <= PARALLEL_EPS) return null
  const w = sub(q, p)
  return { s: (w.x * e.y - w.y * e.x) / den, u: (w.x * d.y - w.y * d.x) / den }
}

/** 한 corner에서 arm마다 [prev쪽 점들, next쪽 점들]을 만든다. */
function jointCaps(c: Vec, arms: Arm[]): Map<Arm, { prev: Vec; next: Vec[] }> {
  const out = new Map<Arm, { prev: Vec; next: Vec[] }>()
  const n = arms.length
  // 각 arm의 next(각도가 커지는 쪽 = +perp) 변 점, 다음 arm의 prev(-perp) 변 점
  const nextPts: Vec[][] = []
  const prevPts: Vec[] = []
  for (let i = 0; i < n; i++) {
    const a = arms[i]!
    const b = arms[(i + 1) % n]!
    const pa = add(c, scale(perp(a.dir), a.half)) // a의 +perp 변 위, corner 옆 점
    const pb = sub(c, scale(perp(b.dir), b.half)) // b의 -perp 변 위, corner 옆 점
    if (n === 1) {
      // 끝이 열린 벽: 직각으로 자른다.
      nextPts[i] = [pa]
      prevPts[(i + 1) % n] = pb
      continue
    }
    let gap = b.angle - a.angle
    if (gap <= 0) gap += 2 * Math.PI
    const hit = intersectLines(pa, a.dir, pb, b.dir)
    const reflex = gap > Math.PI
    let miter: Vec | null = null
    if (hit) {
      const p = add(pa, scale(a.dir, hit.s))
      if (reflex) {
        // 바깥 모서리: 뾰족한 끝이 너무 멀리 나가면 깎는다.
        if (distance(p, c) <= MITER_LIMIT * Math.max(a.half, b.half)) miter = p
      } else if (hit.s <= a.length && hit.u <= b.length) {
        // 안쪽 모서리: 실제 안쪽 면이 만나는 점. 벽 길이를 넘으면 포기하고 겹침 허용.
        miter = p
      }
    }
    if (miter) {
      nextPts[i] = [miter]
      prevPts[(i + 1) % n] = miter
    } else if (reflex) {
      // bevel: 두 직각 끝 사이 삼각형은 a가 가진다(corner → b점 → a점 순서로 이어 붙임).
      nextPts[i] = [pb, pa]
      prevPts[(i + 1) % n] = pb
    } else {
      // 평행 이어짐(180°) 또는 포기: 각자 직각으로 자른다(두께가 다르면 계단).
      nextPts[i] = [pa]
      prevPts[(i + 1) % n] = pb
    }
  }
  arms.forEach((a, i) => out.set(a, { prev: prevPts[i]!, next: nextPts[i]! }))
  return out
}

/**
 * 벽 접합부(마이터)를 계산해 벽마다 위에서 본 다각형을 돌려준다.
 * 각 corner에서 연결된 벽을 각도순으로 정렬하고, 이웃한 두 벽 사이마다 마주 보는 바깥선끼리의 교점을 구한다.
 * 다각형에 corner 자신도 넣어서 T자·십자 접합부 가운데가 벽들로 빈틈없이 나뉘게 한다.
 */
export function wallFootprints(segments: readonly WallSegment[]): Map<string, WallFootprint> {
  const byCorner = new Map<string, { at: Vec; arms: Arm[] }>()
  const armsOf = new Map<string, { start?: Arm; end?: Arm }>()
  const push = (cornerId: string, at: Vec, arm: Arm) => {
    let entry = byCorner.get(cornerId)
    if (!entry) byCorner.set(cornerId, (entry = { at, arms: [] }))
    entry.arms.push(arm)
  }

  for (const { wall, a, b } of segments) {
    const length = distance(a, b)
    if (length === 0) continue
    const u = normalize(sub(b, a))
    const half = wall.thickness / 2
    const start: Arm = { wallId: wall.id, dir: u, angle: Math.atan2(u.y, u.x), half, length }
    const back = scale(u, -1)
    const end: Arm = { wallId: wall.id, dir: back, angle: Math.atan2(back.y, back.x), half, length }
    push(a.id, a, start)
    push(b.id, b, end)
    armsOf.set(wall.id, { start, end })
  }

  const caps = new Map<Arm, Vec[]>()
  for (const { at, arms } of byCorner.values()) {
    arms.sort((p, q) => p.angle - q.angle)
    for (const [arm, { prev, next }] of jointCaps(at, arms)) {
      caps.set(arm, [prev, { x: at.x, y: at.y }, ...next])
    }
  }

  const out = new Map<string, WallFootprint>()
  for (const [wallId, { start, end }] of armsOf) {
    out.set(wallId, { start: caps.get(start!)!, end: caps.get(end!)! })
  }
  return out
}

/** 평면 점을 벽 로컬 좌표로: x = a에서 벽 방향 거리, y = +perp 방향 거리 (mm) */
export function toWallLocal(p: Vec, a: Vec, b: Vec): Vec {
  const u = normalize(sub(b, a))
  const d = sub(p, a)
  return { x: dot(d, u), y: dot(d, perp(u)) }
}

export interface WallPieces {
  /** 개구부를 넣을 수 있는 가운데 직사각형 구간 [x0, x1] (벽 로컬 x). 없으면 null. */
  core: { x0: number; x1: number } | null
  /** 위에서 본 나머지 조각들(벽 로컬 좌표). core가 없으면 다각형 전체 하나. */
  ends: Vec[][]
}

/**
 * 벽 로컬 좌표의 footprint를 3D용으로 나눈다. 양 끝 접합부 조각은 위에서 본 모양 그대로 세우고,
 * 그 사이는 두께가 일정한 직사각형이므로 측면 외곽(개구부 포함)을 두께만큼 밀어 만든다.
 */
export function splitFootprint(local: WallFootprint, half: number): WallPieces {
  const x0 = Math.max(...local.start.map((p) => p.x))
  const x1 = Math.min(...local.end.map((p) => p.x))
  if (!(x1 > x0)) return { core: null, ends: [footprintPolygon(local)] }
  return {
    core: { x0, x1 },
    ends: [
      [...local.start, { x: x0, y: half }, { x: x0, y: -half }],
      [{ x: x1, y: half }, ...local.end, { x: x1, y: -half }],
    ],
  }
}
