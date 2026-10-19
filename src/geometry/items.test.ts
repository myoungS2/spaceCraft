import { createFloor } from '../model/defaults'
import type { Floor } from '../model/schema'
import {
  addItem,
  deleteItem,
  duplicateItem,
  itemCorners,
  itemDims,
  moveItem,
  normalizeAngle,
  resetItemDims,
  rotateItemBy,
  rotateItemTo,
  rotationByDrag,
  snapAngle,
  updateItem,
} from './items'

function withItem(): { floor: Floor; id: string } {
  const r = addItem(createFloor(), 'sofa-3', { x: 1000.4, y: 2000.6 })
  return { floor: r.floor, id: r.itemId }
}
const lock = (f: Floor, id: string) => updateItem(f, id, { locked: true })

describe('각도', () => {
  it('normalizeAngle / snapAngle', () => {
    expect(normalizeAngle(-15)).toBe(345)
    expect(normalizeAngle(720)).toBe(0)
    expect(snapAngle(22)).toBe(15)
    expect(snapAngle(23)).toBe(30)
    expect(snapAngle(-8)).toBe(345)
  })

  it('rotationByDrag: 중심을 축으로 끈 만큼(화면 시계 방향 +) 돌리고 15°에 맞춘다', () => {
    const c = { x: 1000, y: 1000 }
    // 오른쪽 → 아래(y-down 화면에서 시계 방향 90°)
    expect(rotationByDrag(0, c, { x: 2000, y: 1000 }, { x: 1000, y: 2000 })).toBe(90)
    // 시작 각도에 더하고, 반시계로 끌면 줄어든다
    expect(rotationByDrag(30, c, { x: 2000, y: 1000 }, { x: 1000, y: 0 })).toBe(300)
    // 잡은 지점과 상관없이 상대 각도만 쓴다 + 스냅
    expect(rotationByDrag(0, c, { x: 1000, y: 0 }, { x: 1250, y: 100 })).toBe(15)
  })
})

describe('itemCorners', () => {
  it('90° 돌리면 폭·깊이가 바뀐다(시계 방향)', () => {
    const c = itemCorners({ x: 0, y: 0, rotation: 90 }, { width: 2000, depth: 1000 })
    const xs = c.map((p) => Math.round(p.x))
    const ys = c.map((p) => Math.round(p.y))
    expect(Math.max(...xs) - Math.min(...xs)).toBe(1000)
    expect(Math.max(...ys) - Math.min(...ys)).toBe(2000)
    // 왼쪽 위(-w/2,-d/2)는 시계 방향 90° 후 오른쪽 위로 간다
    expect({ x: Math.round(c[0]!.x), y: Math.round(c[0]!.y) }).toEqual({ x: 500, y: -1000 })
  })
})

describe('가구 편집', () => {
  it('추가 시 좌표를 정수 mm로', () => {
    const { floor } = withItem()
    expect(floor.items[0]).toMatchObject({ x: 1000, y: 2001, rotation: 0, locked: false })
  })

  it('잠기면 이동·회전이 안 되고, 잠금 해제는 된다', () => {
    const { floor, id } = withItem()
    const locked = lock(floor, id)
    expect(moveItem(locked, id, { x: 0, y: 0 })).toBe(locked)
    expect(rotateItemTo(locked, id, 90)).toBe(locked)
    expect(updateItem(locked, id, { x: 5 })).toBe(locked)
    expect(updateItem(locked, id, { locked: false }).items[0]!.locked).toBe(false)
  })

  it('rotateItemBy는 15° 격자에 맞춘다', () => {
    const { floor, id } = withItem()
    const r1 = rotateItemTo(floor, id, 10)
    expect(rotateItemBy(r1, id, 15).items[0]!.rotation).toBe(30)
    expect(rotateItemBy(floor, id, -15).items[0]!.rotation).toBe(345)
  })

  it('복제는 비켜 놓고 잠금을 풀어 둔다', () => {
    const { floor, id } = withItem()
    const r = duplicateItem(lock(floor, id), id)
    expect(r.floor.items).toHaveLength(2)
    expect(r.floor.items[1]).toMatchObject({ x: 1300, y: 2301, locked: false, catalogId: 'sofa-3' })
  })

  it('치수 오버라이드와 초기화', () => {
    const { floor, id } = withItem()
    const resized = updateItem(floor, id, { width: 1800 })
    expect(itemDims(resized.items[0]!, { width: 2100, depth: 900, height: 850 })).toEqual({
      width: 1800,
      depth: 900,
      height: 850,
    })
    expect(resetItemDims(resized, id).items[0]!.width).toBeUndefined()
    expect(resetItemDims(floor, id)).toBe(floor)
  })

  it('변화 없는 갱신은 같은 floor, 삭제', () => {
    const { floor, id } = withItem()
    expect(updateItem(floor, id, { x: 1000 })).toBe(floor)
    expect(moveItem(floor, id, { x: 1000, y: 2001 })).toBe(floor)
    expect(deleteItem(floor, id).items).toHaveLength(0)
  })
})
