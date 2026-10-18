import { createFloor } from '../model/defaults'
import type { Floor } from '../model/schema'
import {
  addOpening,
  clampOpenings,
  deleteOpening,
  moveOpening,
  placeOpening,
  updateOpening,
} from './openings'
import { addWall, setWallLength } from './walls'

function wall(len = 4000): { floor: Floor; wallId: string } {
  const r = addWall(createFloor(), { x: 0, y: 0 }, { x: len, y: 0 }, 200)
  return { floor: r.floor, wallId: r.wallId! }
}

const openingsOf = (f: Floor) => f.walls[0]!.openings

describe('placeOpening', () => {
  it('벽 양 끝 밖으로 나가지 않게 클램프한다', () => {
    expect(placeOpening(4000, [], { width: 900 }, 100)).toBe(450)
    expect(placeOpening(4000, [], { width: 900 }, 3900)).toBe(3550)
  })

  it('다른 개구부와 겹치면 가장 가까운 빈 자리로 민다', () => {
    const other = { id: 'a', offset: 2000, width: 1000 }
    expect(placeOpening(4000, [other], { width: 800 }, 2100)).toBe(2900)
    expect(placeOpening(4000, [other], { width: 800 }, 1900)).toBe(1100)
  })

  it('자기 자신은 겹침 대상이 아니다', () => {
    const self = { id: 'a', offset: 2000, width: 1000 }
    expect(placeOpening(4000, [self], self, 2100)).toBe(2100)
  })

  it('자리가 없으면 null', () => {
    expect(placeOpening(800, [], { width: 900 }, 400)).toBeNull()
    expect(placeOpening(2000, [{ id: 'a', offset: 1000, width: 1500 }], { width: 900 }, 1000)).toBeNull()
  })
})

describe('개구부 편집', () => {
  it('문은 기본 치수·sill 0, 창은 sill 900으로 추가된다', () => {
    const { floor, wallId } = wall()
    const d = addOpening(floor, wallId, 'door', 1000)
    const w = addOpening(d.floor, wallId, 'window', 3000)
    expect(openingsOf(w.floor)).toEqual([
      expect.objectContaining({ type: 'door', width: 900, height: 2100, sill: 0, offset: 1000 }),
      expect.objectContaining({ type: 'window', width: 1200, sill: 900, offset: 3000 }),
    ])
  })

  it('놓을 자리가 없으면 추가하지 않는다', () => {
    const { floor, wallId } = wall(80)
    expect(addOpening(floor, wallId, 'door', 40).openingId).toBeUndefined()
  })

  it('moveOpening은 클램프되고 겹치지 않는다', () => {
    const { floor, wallId } = wall()
    const a = addOpening(floor, wallId, 'door', 1000)
    const b = addOpening(a.floor, wallId, 'door', 3000)
    const moved = moveOpening(b.floor, wallId, b.openingId!, 1200)
    expect(openingsOf(moved)[1]!.offset).toBe(1900)
    expect(moveOpening(moved, wallId, a.openingId!, -500).walls[0]!.openings[0]!.offset).toBe(450)
  })

  it('창→문으로 바꾸면 sill 0, 높이는 벽 높이를 넘지 않는다', () => {
    const { floor, wallId } = wall()
    const w = addOpening(floor, wallId, 'window', 2000)
    const asDoor = updateOpening(w.floor, wallId, w.openingId!, { type: 'door' })
    expect(openingsOf(asDoor)[0]).toMatchObject({ type: 'door', sill: 0 })
    const tall = updateOpening(asDoor, wallId, w.openingId!, { height: 9999 })
    expect(openingsOf(tall)[0]!.height).toBe(2300)
  })

  it('폭을 넓혀 겹치게 되면 자리를 옮기고, 놓을 수 없으면 변경하지 않는다', () => {
    const { floor, wallId } = wall()
    const a = addOpening(floor, wallId, 'door', 1000)
    expect(updateOpening(a.floor, wallId, a.openingId!, { width: 5000 })).toBe(a.floor)
    expect(updateOpening(a.floor, wallId, a.openingId!, { width: 900 })).toBe(a.floor)
  })

  it('deleteOpening', () => {
    const { floor, wallId } = wall()
    const a = addOpening(floor, wallId, 'door', 1000)
    expect(openingsOf(deleteOpening(a.floor, wallId, a.openingId!))).toHaveLength(0)
  })
})

describe('clampOpenings', () => {
  it('벽이 짧아지면 개구부를 안으로 밀고, 벽보다 넓으면 줄인다', () => {
    const { floor, wallId } = wall()
    const a = addOpening(floor, wallId, 'window', 3000)
    const shorter = clampOpenings(setWallLength(a.floor, wallId, 2000))
    expect(openingsOf(shorter)[0]).toMatchObject({ offset: 1400, width: 1200 })
    const tiny = clampOpenings(setWallLength(a.floor, wallId, 1000))
    expect(openingsOf(tiny)[0]).toMatchObject({ offset: 500, width: 1000 })
  })

  it('바뀐 게 없으면 같은 floor', () => {
    const { floor, wallId } = wall()
    const a = addOpening(floor, wallId, 'door', 1000)
    expect(clampOpenings(a.floor)).toBe(a.floor)
  })
})
