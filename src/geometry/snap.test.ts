import { createFloor } from '../model/defaults'
import { snapPoint, type SnapOptions } from './snap'
import { addWall, wallSegments } from './walls'

function opts(extra: Partial<SnapOptions> = {}): SnapOptions {
  const { floor } = addWall(createFloor(), { x: 0, y: 0 }, { x: 4000, y: 0 }, 200)
  return { grid: 50, tolerance: 100, corners: floor.corners, walls: wallSegments(floor), ...extra }
}

describe('snapPoint', () => {
  it('아무것도 가깝지 않으면 그리드에 붙는다', () => {
    expect(snapPoint({ x: 1234, y: 2276 }, opts())).toMatchObject({ x: 1250, y: 2300, kind: 'grid' })
  })

  it('허용 거리 안의 꼭짓점이 최우선이다', () => {
    const r = snapPoint({ x: 3950, y: 60 }, opts())
    expect(r).toMatchObject({ x: 4000, y: 0, kind: 'corner' })
    expect(r.cornerId).toBeDefined()
  })

  it('벽 중간 근처면 벽 위로 정사영한다', () => {
    const r = snapPoint({ x: 1234, y: 70 }, opts())
    expect(r).toMatchObject({ x: 1234, y: 0, kind: 'wall' })
    expect(r.wallId).toBeDefined()
  })

  it('ortho는 anchor 기준 큰 축만 움직이고 그 축에 그리드를 적용한다', () => {
    const r = snapPoint({ x: 1000, y: 3020 }, opts({ anchor: { x: 990, y: 1000 }, ortho: true, walls: [] }))
    expect(r).toMatchObject({ x: 990, y: 3000, kind: 'grid' })
  })

  it('ortho에서는 축 위에 있는 꼭짓점만 스냅한다', () => {
    const off = snapPoint({ x: 4000, y: 80 }, opts({ anchor: { x: 0, y: 2000 }, ortho: true }))
    expect(off.kind).toBe('grid')
    const on = snapPoint({ x: 3960, y: 30 }, opts({ anchor: { x: 0, y: 0 }, ortho: true }))
    expect(on).toMatchObject({ x: 4000, y: 0, kind: 'corner' })
  })

  it('excludeCornerIds의 꼭짓점과 거기 붙은 벽은 무시한다', () => {
    const o = opts()
    const exclude = new Set(o.corners.map((c) => c.id))
    expect(snapPoint({ x: 3990, y: 10 }, { ...o, excludeCornerIds: exclude }).kind).toBe('grid')
  })
})
