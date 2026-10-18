import { createFloor } from '../model/defaults'
import type { Floor } from '../model/schema'
import {
  addWall,
  deleteCorner,
  deleteWall,
  getSegment,
  mergeCorners,
  moveCorner,
  setWallLength,
  splitWall,
  updateWall,
  wallLength,
} from './walls'

/** (0,0) → (4000,0) 벽 하나와 문 2개 */
function oneWall(): { floor: Floor; wallId: string } {
  const r = addWall(createFloor(), { x: 0, y: 0 }, { x: 4000, y: 0 }, 200)
  const floor: Floor = {
    ...r.floor,
    walls: r.floor.walls.map((w) => ({
      ...w,
      openings: [
        { id: 'o_a', type: 'door', offset: 1000, width: 800, height: 2100, sill: 0 },
        { id: 'o_b', type: 'window', offset: 3000, width: 1000, height: 1200, sill: 900 },
      ],
    })),
  }
  return { floor, wallId: r.wallId! }
}

describe('addWall', () => {
  it('corner 두 개와 벽 하나를 만든다', () => {
    const { floor } = oneWall()
    expect(floor.corners).toHaveLength(2)
    expect(floor.walls).toHaveLength(1)
  })

  it('같은 좌표의 corner는 재사용한다(연속 그리기)', () => {
    const { floor } = oneWall()
    const r = addWall(floor, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, 200)
    expect(r.floor.corners).toHaveLength(3)
    expect(r.floor.walls).toHaveLength(2)
  })

  it('길이 0 또는 중복 벽은 만들지 않는다', () => {
    const { floor } = oneWall()
    expect(addWall(floor, { x: 10, y: 10 }, { x: 10, y: 10 }, 200).floor.walls).toHaveLength(1)
    expect(addWall(floor, { x: 4000, y: 0 }, { x: 0, y: 0 }, 200).floor.walls).toHaveLength(1)
  })

  it('끝점이 다른 벽 중간이면 그 벽을 분할해 T자를 만든다', () => {
    const { floor, wallId } = oneWall()
    const r = addWall(floor, { x: 2000, y: 0, wallId }, { x: 2000, y: 3000 }, 200)
    expect(r.floor.walls).toHaveLength(3)
    const tCorner = r.floor.corners.find((c) => c.x === 2000 && c.y === 0)!
    const touching = r.floor.walls.filter((w) => w.start === tCorner.id || w.end === tCorner.id)
    expect(touching).toHaveLength(3)
  })

  it('시작점 분할로 가리키던 벽이 사라져도 끝점의 벽을 다시 찾는다', () => {
    const { floor, wallId } = oneWall()
    const r = addWall(floor, { x: 1000, y: 0, wallId }, { x: 3000, y: 0, wallId }, 200)
    // 1000과 3000 두 번 분할 → 원래 벽 3조각. 새 벽은 가운데 조각과 같은 corner 쌍이라 중복으로 처리된다
    expect(r.floor.corners).toHaveLength(4)
    expect(r.floor.walls).toHaveLength(3)
    expect(r.wallId).toBeUndefined()
  })
})

describe('splitWall', () => {
  it('개구부를 중심 위치 기준으로 배분하고 offset을 다시 계산한다', () => {
    const { floor, wallId } = oneWall()
    const r = splitWall(floor, wallId, { x: 2500, y: 30 })
    const [first, second] = r.floor.walls
    expect(first!.openings.map((o) => o.id)).toEqual(['o_a'])
    expect(second!.openings).toEqual([expect.objectContaining({ id: 'o_b', offset: 500 })])
    expect(r.floor.corners.find((c) => c.id === r.cornerId)).toMatchObject({ x: 2500, y: 0 })
  })

  it('끝점에서 분할하면 기존 corner를 돌려준다', () => {
    const { floor, wallId } = oneWall()
    const r = splitWall(floor, wallId, { x: 0, y: 0 })
    expect(r.floor).toBe(floor)
  })
})

describe('편집', () => {
  it('setWallLength는 end corner를 벽 방향으로 옮긴다', () => {
    const { floor, wallId } = oneWall()
    const next = setWallLength(floor, wallId, 2500)
    expect(wallLength(next, wallId)).toBe(2500)
    expect(getSegment(next, wallId)!.b).toMatchObject({ x: 2500, y: 0 })
  })

  it('moveCorner는 연결된 벽을 새 객체로 바꾸고, 변화 없으면 같은 floor', () => {
    const { floor, wallId } = oneWall()
    const end = getSegment(floor, wallId)!.b
    expect(moveCorner(floor, end.id, { x: 4000, y: 0 })).toBe(floor)
    const moved = moveCorner(floor, end.id, { x: 4000.4, y: 999.6 })
    expect(moved.corners.find((c) => c.id === end.id)).toMatchObject({ x: 4000, y: 1000 })
    expect(moved.walls[0]).not.toBe(floor.walls[0])
  })

  it('deleteWall은 고립된 corner를 정리한다', () => {
    const { floor, wallId } = oneWall()
    const two = addWall(floor, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, 200)
    const next = deleteWall(two.floor, wallId)
    expect(next.walls).toHaveLength(1)
    expect(next.corners).toHaveLength(2)
  })

  it('deleteCorner는 연결된 벽을 모두 지운다', () => {
    const { floor } = oneWall()
    const two = addWall(floor, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, 200)
    const shared = two.floor.corners.find((c) => c.x === 4000 && c.y === 0)!
    const next = deleteCorner(two.floor, shared.id)
    expect(next.walls).toHaveLength(0)
    expect(next.corners).toHaveLength(0)
  })

  it('mergeCorners는 꼭짓점을 합치고 길이 0·중복 벽을 지운다', () => {
    // ㄱ자 (0,0)-(4000,0)-(4000,3000) 에서 끝점 (4000,3000)을 (0,0)에 합치면 삼각형이 아니라
    // (0,0)-(4000,0) 벽과 (4000,0)-(0,0) 벽이 중복 → 벽 1개만 남는다
    const { floor } = oneWall()
    const two = addWall(floor, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, 200)
    const origin = two.floor.corners.find((c) => c.x === 0 && c.y === 0)!
    const merged = mergeCorners(two.floor, two.endId, origin.id)
    expect(merged.walls).toHaveLength(1)
    expect(merged.corners).toHaveLength(2)
  })

  it('updateWall은 값이 같으면 같은 floor를 돌려준다', () => {
    const { floor, wallId } = oneWall()
    expect(updateWall(floor, wallId, { thickness: 200 })).toBe(floor)
    expect(updateWall(floor, wallId, { thickness: 150 }).walls[0]!.thickness).toBe(150)
  })
})
