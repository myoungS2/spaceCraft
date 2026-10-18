import type { Corner, Wall } from '../model/schema'
import { signedArea } from './rooms'
import type { WallSegment } from './walls'
import { MITER_LIMIT, footprintPolygon, splitFootprint, toWallLocal, wallFootprints, type WallFootprint } from './wallJoints'
import { distance, type Vec } from './vec'

/** 꼭짓점 이름 → 좌표, 벽 [시작, 끝, 두께?] 목록으로 선분을 만든다. */
function build(points: Record<string, [number, number]>, walls: [string, string, number?][]): WallSegment[] {
  const corners = new Map<string, Corner>(Object.entries(points).map(([id, [x, y]]) => [id, { id, x, y }]))
  return walls.map(([s, e, t], i) => {
    const wall: Wall = { id: `w${i}`, start: s, end: e, thickness: t ?? 200, openings: [] }
    return { wall, a: corners.get(s)!, b: corners.get(e)! }
  })
}

const areas = (fps: Map<string, WallFootprint>) => [...fps.values()].map((f) => signedArea(footprintPolygon(f)))
/** 모든 다각형이 같은 방향(겹쳐 뒤집힌 것 없음)이고 넓이 합이 기대값(=합집합 넓이, 틈·겹침 없음)인지 */
function expectTiles(fps: Map<string, WallFootprint>, unionArea: number) {
  const a = areas(fps)
  expect(a.every((v) => v < 0) || a.every((v) => v > 0)).toBe(true)
  expect(Math.abs(a.reduce((s, v) => s + v, 0))).toBeCloseTo(unionArea, 3)
}
const near = (p: Vec, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 6)
  expect(p.y).toBeCloseTo(y, 6)
}
const hasPoint = (pts: Vec[], x: number, y: number) => pts.some((p) => distance(p, { x, y }) < 1e-6)

describe('wallFootprints', () => {
  it('끝이 열린 벽 하나는 두께만큼 부풀린 사각형', () => {
    const fps = wallFootprints(build({ a: [0, 0], b: [4000, 0] }, [['a', 'b']]))
    const f = fps.get('w0')!
    near(f.start[0]!, 0, -100)
    near(f.start[2]!, 0, 100)
    near(f.end[0]!, 4000, 100)
    near(f.end[2]!, 4000, -100)
    expectTiles(fps, 4000 * 200)
  })

  it('ㄱ자: 안쪽·바깥 모서리 교점으로 45° 마이터', () => {
    const fps = wallFootprints(
      build({ a: [0, 0], b: [4000, 0], c: [4000, 3000] }, [['a', 'b'], ['b', 'c']]),
    )
    const w0 = fps.get('w0')!
    const w1 = fps.get('w1')!
    // 바깥 (4100,-100), 안쪽 (3900,100)을 두 벽이 함께 쓴다.
    for (const cap of [w0.end, w1.start]) {
      expect(hasPoint(cap, 4100, -100)).toBe(true)
      expect(hasPoint(cap, 3900, 100)).toBe(true)
    }
    expectTiles(fps, 4100 * 200 + 200 * 2900)
  })

  it('사각형 방: 네 모서리 모두 맞물린다', () => {
    const fps = wallFootprints(
      build(
        { a: [0, 0], b: [4000, 0], c: [4000, 3000], d: [0, 3000] },
        [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']],
      ),
    )
    expectTiles(fps, 4200 * 3200 - 3800 * 2800)
  })

  it('T자: 관통 벽은 직각, 가지 벽은 양쪽 교점, 가운데는 빈틈없이 나뉜다', () => {
    const fps = wallFootprints(
      build({ o: [0, 0], e: [2000, 0], w: [-2000, 0], s: [0, 2000] }, [['o', 'e'], ['o', 'w'], ['o', 's']]),
    )
    const east = fps.get('w0')!.start
    const south = fps.get('w2')!.start
    expect(hasPoint(east, 0, -100)).toBe(true) // 반대편(180° 이어짐)은 직각
    expect(hasPoint(east, 100, 100)).toBe(true)
    expect(hasPoint(south, 100, 100)).toBe(true)
    expect(hasPoint(south, -100, 100)).toBe(true)
    expectTiles(fps, 4000 * 200 + 1900 * 200)
  })

  it('십자: 네 교점을 이웃끼리 나눠 가진다', () => {
    const fps = wallFootprints(
      build(
        { o: [0, 0], e: [2000, 0], s: [0, 2000], w: [-2000, 0], n: [0, -2000] },
        [['o', 'e'], ['o', 's'], ['w', 'o'], ['n', 'o']],
      ),
    )
    for (const [x, y] of [[100, 100], [-100, 100], [-100, -100], [100, -100]] as const) {
      const owners = [...fps.values()].filter((f) => hasPoint([...f.start, ...f.end], x, y))
      expect(owners).toHaveLength(2)
    }
    expectTiles(fps, 4000 * 200 * 2 - 200 * 200)
  })

  it('60°: 바깥 끝은 한도 안이라 뾰족한 마이터', () => {
    const r = 3000
    const deg = (60 * Math.PI) / 180
    const fps = wallFootprints(
      build({ o: [0, 0], a: [r, 0], b: [r * Math.cos(deg), r * Math.sin(deg)] }, [['o', 'a'], ['o', 'b']]),
    )
    // 꼭지점에서 두께/2 / sin(30°) = 200 거리, 이등분선 반대쪽
    const outer = { x: -200 * Math.cos(deg / 2), y: -200 * Math.sin(deg / 2) }
    const inner = { x: 200 * Math.cos(deg / 2), y: 200 * Math.sin(deg / 2) }
    for (const f of fps.values()) {
      expect(hasPoint(f.start, outer.x, outer.y)).toBe(true)
      expect(hasPoint(f.start, inner.x, inner.y)).toBe(true)
    }
  })

  it('예각(20°): 안쪽은 실제 교점, 바깥 끝은 한도를 넘어 깎는다(bevel)', () => {
    const r = 3000
    const deg = (20 * Math.PI) / 180
    const fps = wallFootprints(
      build({ o: [0, 0], a: [r, 0], b: [r * Math.cos(deg), r * Math.sin(deg)] }, [['o', 'a'], ['o', 'b']]),
    )
    const innerDist = 100 / Math.sin(deg / 2)
    const inner = { x: innerDist * Math.cos(deg / 2), y: innerDist * Math.sin(deg / 2) }
    const pts = [...fps.values()].flatMap((f) => [...f.start])
    for (const f of fps.values()) expect(hasPoint(f.start, inner.x, inner.y)).toBe(true)
    // 안쪽 교점 말고는 corner에서 한도 이내
    for (const p of pts) {
      if (distance(p, inner) < 1e-6) continue
      expect(distance(p, { x: 0, y: 0 })).toBeLessThanOrEqual(MITER_LIMIT * 100 + 1e-6)
    }
    // 두 벽의 직각 끝 (0,-100)과 (-100sin20°, 100cos20°)이 bevel 변으로 이어진다.
    expect(hasPoint(pts, 0, -100)).toBe(true)
    expect(hasPoint(pts, -100 * Math.sin(deg), 100 * Math.cos(deg))).toBe(true)
    // bevel 삼각형을 붙여도 다각형이 뒤집히지 않는다.
    const a = areas(fps)
    expect(a.every((v) => v < 0) || a.every((v) => v > 0)).toBe(true)
  })

  it('평행 이어짐: 같은 두께는 이음매가 직각, 두께가 다르면 각자 직각(계단)', () => {
    const same = wallFootprints(build({ a: [0, 0], b: [2000, 0], c: [4000, 0] }, [['a', 'b'], ['b', 'c']]))
    expect(same.get('w0')!.end.filter((p) => p.x === 2000)).toHaveLength(3)
    expect(same.get('w1')!.start.every((p) => p.x === 2000)).toBe(true)
    expectTiles(same, 4000 * 200)

    const diff = wallFootprints(build({ a: [0, 0], b: [2000, 0], c: [4000, 0] }, [['a', 'b', 200], ['b', 'c', 100]]))
    expect(hasPoint(diff.get('w0')!.end, 2000, 100)).toBe(true)
    expect(hasPoint(diff.get('w1')!.start, 2000, 50)).toBe(true)
    expectTiles(diff, 2000 * 200 + 2000 * 100)
  })

  it('안쪽 교점이 벽 길이를 넘으면 직각으로 자르고 겹침을 허용한다', () => {
    const deg = (5 * Math.PI) / 180
    const fps = wallFootprints(
      build({ o: [0, 0], a: [500, 0], b: [500 * Math.cos(deg), 500 * Math.sin(deg)] }, [['o', 'a'], ['o', 'b']]),
    )
    for (const f of fps.values()) {
      for (const p of f.start) expect(distance(p, { x: 0, y: 0 })).toBeLessThanOrEqual(MITER_LIMIT * 100 + 1e-6)
    }
  })
})

describe('splitFootprint', () => {
  it('ㄱ자 벽: 가운데 직사각형 구간과 양 끝 조각으로 나눈다', () => {
    const segs = build({ a: [0, 0], b: [4000, 0], c: [4000, 3000] }, [['a', 'b'], ['b', 'c']])
    const fp = wallFootprints(segs).get('w0')!
    const { a, b } = segs[0]!
    const local = { start: fp.start.map((p) => toWallLocal(p, a, b)), end: fp.end.map((p) => toWallLocal(p, a, b)) }
    const pieces = splitFootprint(local, 100)
    expect(pieces.core).toEqual({ x0: 0, x1: 3900 })
    const total =
      pieces.ends.reduce((s, poly) => s + Math.abs(signedArea(poly)), 0) + (pieces.core!.x1 - pieces.core!.x0) * 200
    expect(total).toBeCloseTo(4100 * 200 - 200 * 200 / 2, 6)
  })

  it('양 끝 조각이 겹칠 만큼 짧으면 다각형 하나로', () => {
    const segs = build({ a: [0, 0], b: [150, 0], c: [150, 3000], d: [0, -3000] }, [['a', 'b'], ['b', 'c'], ['a', 'd']])
    const fp = wallFootprints(segs).get('w0')!
    const { a, b } = segs[0]!
    const local = { start: fp.start.map((p) => toWallLocal(p, a, b)), end: fp.end.map((p) => toWallLocal(p, a, b)) }
    const pieces = splitFootprint(local, 100)
    expect(pieces.core).toBeNull()
    expect(pieces.ends).toHaveLength(1)
  })
})
