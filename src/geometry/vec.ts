export interface Vec {
  x: number
  y: number
}

export const vec = (x: number, y: number): Vec => ({ x, y })
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k })
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y
export const length = (a: Vec): number => Math.hypot(a.x, a.y)
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y)
export const roundVec = (a: Vec): Vec => ({ x: Math.round(a.x), y: Math.round(a.y) })

export function normalize(a: Vec): Vec {
  const len = length(a)
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len }
}

/** 화면(y-down)에서 방향 벡터를 시계 방향 90° 돌린 법선 */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x })

export interface Projection {
  /** 선분 위 매개변수 0..1 (클램프됨) */
  t: number
  point: Vec
  distance: number
}

/** 점 p를 선분 ab에 정사영한다. */
export function projectOnSegment(p: Vec, a: Vec, b: Vec): Projection {
  const ab = sub(b, a)
  const lenSq = dot(ab, ab)
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / lenSq))
  const point = add(a, scale(ab, t))
  return { t, point, distance: distance(p, point) }
}
