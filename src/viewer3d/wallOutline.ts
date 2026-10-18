import type { Vec } from '../geometry/vec'
import type { Opening } from '../model/schema'

/** 바닥·천장에 동시에 닿는 개구부는 벽이 끊기지 않도록 위에 남기는 인방 높이(mm) */
export const MIN_LINTEL = 20

export interface WallOutline {
  /** 벽 측면 외곽(반시계). x = 벽 시작점부터 거리, y = 바닥부터 높이 (mm) */
  outer: Vec[]
  /** 벽 안쪽에 떠 있는 개구부(창) 구멍 */
  holes: Vec[][]
}

/**
 * 벽을 옆에서 본 2D 형상. 바닥에 닿는 문은 Shape hole이 외곽선에 닿으면 삼각분할이 깨지므로
 * 외곽선을 아래에서 파내는(notch) 방식으로, 천장에 닿는 개구부는 위에서 파낸다. 나머지는 hole.
 */
export function wallOutline(length: number, height: number, openings: readonly Opening[]): WallOutline {
  const spans = openings
    .map((o) => {
      const s = Math.max(0, o.offset - o.width / 2)
      const e = Math.min(length, o.offset + o.width / 2)
      let bottom = Math.max(0, o.type === 'door' ? 0 : o.sill)
      let top = Math.min(height, bottom + o.height)
      if (bottom <= 0 && top >= height) top = height - MIN_LINTEL
      if (top <= bottom) bottom = top
      return { s, e, bottom, top }
    })
    .filter((o) => o.e - o.s > 0 && o.top - o.bottom > 0)
    .sort((a, b) => a.s - b.s)

  const fromFloor = spans.filter((o) => o.bottom <= 0)
  const toCeiling = spans.filter((o) => o.bottom > 0 && o.top >= height)
  const floating = spans.filter((o) => o.bottom > 0 && o.top < height)

  const outer: Vec[] = [{ x: 0, y: 0 }]
  // 아랫변: 왼쪽 → 오른쪽, 문 자리는 위로 파냄
  for (const o of fromFloor) {
    outer.push({ x: o.s, y: 0 }, { x: o.s, y: o.top }, { x: o.e, y: o.top }, { x: o.e, y: 0 })
  }
  outer.push({ x: length, y: 0 }, { x: length, y: height })
  // 윗변: 오른쪽 → 왼쪽, 천장에 닿는 개구부는 아래로 파냄
  for (const o of [...toCeiling].reverse()) {
    outer.push({ x: o.e, y: height }, { x: o.e, y: o.bottom }, { x: o.s, y: o.bottom }, { x: o.s, y: height })
  }
  outer.push({ x: 0, y: height })

  const holes = floating.map((o) => [
    { x: o.s, y: o.bottom },
    { x: o.s, y: o.top },
    { x: o.e, y: o.top },
    { x: o.e, y: o.bottom },
  ])

  return { outer: removeCollinear(outer), holes }
}

/**
 * 중복 점과 한 직선 위의 점을 지운다. 개구부가 벽 끝에 붙으면
 * (0,높이)→(0,0)→(0,문높이) 같은 폭 0짜리 가시가 생기는데, 이것도 같은 직선이라 함께 사라진다.
 */
export function removeCollinear(points: readonly Vec[]): Vec[] {
  const pts = [...points]
  let changed = true
  while (changed && pts.length > 3) {
    changed = false
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length]!
      const cur = pts[i]!
      const next = pts[(i + 1) % pts.length]!
      const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x)
      if (cross === 0) {
        pts.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return pts
}
