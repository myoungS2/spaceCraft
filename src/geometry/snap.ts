import type { Corner } from '../model/schema'
import type { PointRef, WallSegment } from './walls'
import { distance, projectOnSegment, roundVec, type Vec } from './vec'

export type SnapKind = 'corner' | 'wall' | 'grid'

export interface SnapResult extends PointRef {
  kind: SnapKind
}

export interface SnapOptions {
  grid: number
  /** 꼭짓점·벽 스냅 허용 거리(mm). 화면 px을 현재 줌으로 환산해서 넘긴다. */
  tolerance: number
  corners: readonly Corner[]
  walls: readonly WallSegment[]
  /** 연속 그리기의 직전 점. ortho일 때 기준이 된다. */
  anchor?: Vec
  /** Shift: anchor 기준 수평/수직 고정 */
  ortho?: boolean
  /** 드래그 중인 자기 자신 등 스냅 대상에서 뺄 corner */
  excludeCornerIds?: ReadonlySet<string>
}

export const snapToGrid = (v: number, grid: number): number => Math.round(v / grid) * grid

/** anchor 기준으로 변화량이 큰 축만 남긴다. */
export function orthogonalize(p: Vec, anchor: Vec): { point: Vec; axis: 'x' | 'y' } {
  return Math.abs(p.x - anchor.x) >= Math.abs(p.y - anchor.y)
    ? { point: { x: p.x, y: anchor.y }, axis: 'x' }
    : { point: { x: anchor.x, y: p.y }, axis: 'y' }
}

/**
 * 우선순위: 꼭짓점 → 벽 위 → 그리드.
 * ortho면 먼저 축을 고정하고, 그 축 위에 있는 꼭짓점만 스냅 대상으로 본다. 그리드는 움직이는 축에만 적용한다.
 */
export function snapPoint(p: Vec, opts: SnapOptions): SnapResult {
  const { grid, tolerance, corners, walls, anchor, excludeCornerIds } = opts
  const ortho = opts.ortho && anchor ? orthogonalize(p, anchor) : undefined
  const target = ortho?.point ?? p

  let best: Corner | undefined
  let bestDist = tolerance
  for (const c of corners) {
    if (excludeCornerIds?.has(c.id)) continue
    if (ortho && anchor && (ortho.axis === 'x' ? c.y !== anchor.y : c.x !== anchor.x)) continue
    const d = distance(c, target)
    if (d <= bestDist) {
      best = c
      bestDist = d
    }
  }
  if (best) return { x: best.x, y: best.y, cornerId: best.id, kind: 'corner' }

  if (!ortho) {
    let wallHit: { point: Vec; wallId: string } | undefined
    let wallDist = tolerance
    for (const s of walls) {
      if (excludeCornerIds?.has(s.a.id) || excludeCornerIds?.has(s.b.id)) continue
      const proj = projectOnSegment(p, s.a, s.b)
      if (proj.t <= 0 || proj.t >= 1) continue
      if (proj.distance <= wallDist) {
        wallHit = { point: proj.point, wallId: s.wall.id }
        wallDist = proj.distance
      }
    }
    if (wallHit) return { ...roundVec(wallHit.point), wallId: wallHit.wallId, kind: 'wall' }
  }

  if (ortho && anchor) {
    return ortho.axis === 'x'
      ? { x: snapToGrid(target.x, grid), y: anchor.y, kind: 'grid' }
      : { x: anchor.x, y: snapToGrid(target.y, grid), kind: 'grid' }
  }
  return { x: snapToGrid(p.x, grid), y: snapToGrid(p.y, grid), kind: 'grid' }
}
