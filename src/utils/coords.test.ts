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

describe('3D 배치 보조', () => {
  it('2D 방향 (1,0)은 회전 0, 화면 아래 (0,1)은 -90°', async () => {
    const { planDirectionToWorldY } = await import('./coords')
    expect(planDirectionToWorldY(1, 0)).toBeCloseTo(0)
    expect(planDirectionToWorldY(0, 1)).toBeCloseTo(-Math.PI / 2)
  })

  it('바닥 Shape 좌표를 X축 -90° 돌리면 planToWorld와 같은 점이 된다', async () => {
    const { planToFloorShape, FLOOR_SHAPE_ROTATION_X, planToWorld } = await import('./coords')
    const [sx, sy] = planToFloorShape(1500, 3000)
    const c = Math.cos(FLOOR_SHAPE_ROTATION_X)
    const s = Math.sin(FLOOR_SHAPE_ROTATION_X)
    const rotated = [sx, sy * c, sy * s]
    const expected = planToWorld(1500, 3000)
    rotated.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!))
  })
})
