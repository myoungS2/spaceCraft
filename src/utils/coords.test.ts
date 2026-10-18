import { mToMm, planRotationToWorldY, planToWorld, worldToPlan } from './coords'

describe('coords', () => {
  it('2D mm → 3D m, y는 z로 간다', () => {
    expect(planToWorld(1500, 3000, 2300)).toEqual([1.5, 2.3, 3])
  })

  it('왕복하면 정수 mm로 돌아온다', () => {
    const [x, , z] = planToWorld(1234, -567)
    expect(worldToPlan(x, z)).toEqual({ x: 1234, y: -567 })
    expect(mToMm(0.1 + 0.2)).toBe(300)
  })

  it('2D 시계 방향 90°는 3D Y축 -90°', () => {
    expect(planRotationToWorldY(90)).toBeCloseTo(-Math.PI / 2)
  })
})
