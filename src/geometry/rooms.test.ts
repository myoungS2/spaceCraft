import { createFloor } from '../model/defaults'
import type { Floor } from '../model/schema'
import { areaM2, centroid, detectFaces, pointInPolygon, syncRooms } from './rooms'
import { addWall, deleteWall, moveCorner, type PointRef } from './walls'

/** 점들을 순서대로 이어 그린다(closed면 처음 점으로 닫음). */
function draw(floor: Floor, pts: PointRef[], closed = false): Floor {
  let f = floor
  const seq = closed ? [...pts, pts[0]!] : pts
  for (let i = 0; i < seq.length - 1; i++) f = addWall(f, seq[i]!, seq[i + 1]!, 200).floor
  return f
}

const square = (size = 4000) =>
  draw(createFloor(), [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: 3000 }, { x: 0, y: 3000 }], true)

const sync = (f: Floor) => syncRooms(f, f)

describe('detectFaces', () => {
  it('사각형 하나 → 방 1개, 시계/반시계 방향 무관', () => {
    expect(detectFaces(square())).toHaveLength(1)
    const ccw = draw(createFloor(), [{ x: 0, y: 0 }, { x: 0, y: 3000 }, { x: 4000, y: 3000 }, { x: 4000, y: 0 }], true)
    expect(detectFaces(ccw)).toHaveLength(1)
  })

  it('열린 벽 사슬은 방이 아니다', () => {
    expect(detectFaces(draw(createFloor(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }]))).toHaveLength(0)
  })

  it('가운데 벽(T자 2개)으로 나누면 방 2개', () => {
    const f = draw(square(), [{ x: 2000, y: 0 }, { x: 2000, y: 3000 }])
    expect(detectFaces(f)).toHaveLength(2)
  })

  it('방 안으로 튀어나온 벽(막힌 끝)은 무시한다', () => {
    const f = draw(square(), [{ x: 2000, y: 0 }, { x: 2000, y: 1500 }])
    const faces = detectFaces(f)
    expect(faces).toHaveLength(1)
  })

  it('ㅁ자 옆에 붙은 ㄷ자로 방 2개(벽 공유)', () => {
    const f = draw(square(), [{ x: 4000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 3000 }, { x: 4000, y: 3000 }])
    expect(detectFaces(f)).toHaveLength(2)
  })
})

describe('면적·위치', () => {
  it('4m×3m = 12.0m²', () => {
    const f = sync(square())
    const corners = new Map(f.corners.map((c) => [c.id, c]))
    const poly = f.rooms[0]!.cornerIds.map((id) => corners.get(id)!)
    expect(areaM2(poly)).toBe(12)
    expect(centroid(poly)).toEqual({ x: 2000, y: 1500 })
    expect(pointInPolygon({ x: 100, y: 100 }, poly)).toBe(true)
    expect(pointInPolygon({ x: -100, y: 100 }, poly)).toBe(false)
  })
})

describe('syncRooms', () => {
  it('방이 생기고, 벽을 지우면 사라진다', () => {
    const f = sync(square())
    expect(f.rooms).toHaveLength(1)
    expect(f.rooms[0]!.name).toBe('방 1')
    const opened = syncRooms(f, deleteWall(f, f.walls[0]!.id))
    expect(opened.rooms).toHaveLength(0)
  })

  it('꼭짓점 이동은 구조 변화가 아니므로 rooms를 그대로 둔다', () => {
    const f = sync(square())
    const moved = moveCorner(f, f.corners[0]!.id, { x: -500, y: 0 })
    expect(syncRooms(f, moved).rooms).toBe(f.rooms)
  })

  it('벽 분할로 꼭짓점이 늘어도 이름·색을 유지한다', () => {
    const f = sync(square())
    const renamed: Floor = { ...f, rooms: [{ ...f.rooms[0]!, name: '거실', floorColor: '#123456' }] }
    // 윗벽 중간에서 바깥으로 벽을 내면 방 경계에 꼭짓점이 하나 생긴다
    const wallId = renamed.walls[0]!.id
    const next = syncRooms(renamed, addWall(renamed, { x: 2000, y: 0, wallId }, { x: 2000, y: -1000 }, 200).floor)
    expect(next.rooms).toHaveLength(1)
    expect(next.rooms[0]).toMatchObject({ id: f.rooms[0]!.id, name: '거실', floorColor: '#123456' })
    expect(next.rooms[0]!.cornerIds).toHaveLength(5)
  })

  it('방을 둘로 나누면 한쪽은 이름을 잇고 다른 쪽은 새 이름', () => {
    const f = sync(square())
    const renamed: Floor = { ...f, rooms: [{ ...f.rooms[0]!, name: '거실' }] }
    const split = syncRooms(renamed, draw(renamed, [{ x: 1000, y: 0 }, { x: 1000, y: 3000 }]))
    expect(split.rooms.map((r) => r.name).sort()).toEqual(['거실', '방 1'])
  })
})
