import { addOpening } from '../geometry/openings'
import { addItem } from '../geometry/items'
import { syncRooms } from '../geometry/rooms'
import { addWall } from '../geometry/walls'
import { createEmptyDoc } from './defaults'
import { deserializeDoc, exportFileName, serializeDoc } from './io'
import type { Doc, Floor } from './schema'

function richDoc(): Doc {
  const doc = createEmptyDoc()
  let f: Floor = doc.floors[0]!
  const pts = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
    { x: 0, y: 0 },
  ]
  for (let i = 0; i < pts.length - 1; i++) f = addWall(f, pts[i]!, pts[i + 1]!, 200).floor
  f = syncRooms(f, f)
  f = addOpening(f, f.walls[0]!.id, 'door', 1000).floor
  f = addItem(f, 'sofa-3', { x: 2000, y: 1500 }, 90).floor
  return { ...doc, floors: [f] }
}

describe('JSON 내보내기·불러오기', () => {
  it('벽·방·개구부·가구가 있는 문서를 왕복해도 같다', () => {
    const doc = richDoc()
    expect(doc.floors[0]!.rooms).toHaveLength(1)
    expect(deserializeDoc(serializeDoc(doc))).toEqual({ ok: true, doc })
  })

  it('JSON이 아니면 실패', () => {
    expect(deserializeDoc('{oops')).toEqual({ ok: false, error: 'JSON 형식이 아닙니다.' })
  })

  it('스키마가 틀리면 경로를 알려준다', () => {
    const bad = JSON.parse(serializeDoc(richDoc()))
    bad.floors[0].items[0].rotation = 'ninety'
    const r = deserializeDoc(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('floors.0.items.0.rotation')
  })

  it('파일 이름은 로컬 시각', () => {
    expect(exportFileName(new Date(2026, 9, 18, 9, 5))).toBe('roomie-20261018-0905.json')
  })
})
