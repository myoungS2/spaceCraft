import { MAX_SCALE, screenToWorld, worldToScreen, zoomAt } from './viewport'

describe('viewport', () => {
  const vp = { x: 100, y: 50, scale: 0.1 }

  it('screen ↔ world 왕복', () => {
    const w = screenToWorld({ x: 300, y: 250 }, vp)
    expect(w).toEqual({ x: 2000, y: 2000 })
    expect(worldToScreen(w, vp)).toEqual({ x: 300, y: 250 })
  })

  it('zoomAt은 커서 아래 월드 좌표를 유지한다', () => {
    const cursor = { x: 300, y: 250 }
    const before = screenToWorld(cursor, vp)
    const next = zoomAt(vp, cursor, 2)
    expect(next.scale).toBeCloseTo(0.2)
    const after = screenToWorld(cursor, next)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('배율은 범위 안으로 제한된다', () => {
    expect(zoomAt(vp, { x: 0, y: 0 }, 1000).scale).toBe(MAX_SCALE)
  })
})
