import { createEmptyDoc } from './defaults'
import { parseDoc } from './migrate'
import type { Doc } from './schema'

function sampleDoc(): Doc {
  const doc = createEmptyDoc()
  const floor = doc.floors[0]!
  floor.corners = [
    { id: 'c_a', x: 0, y: 0 },
    { id: 'c_b', x: 3000, y: 0 },
  ]
  floor.walls = [
    {
      id: 'w_1',
      start: 'c_a',
      end: 'c_b',
      thickness: 200,
      openings: [{ id: 'o_1', type: 'door', offset: 1500, width: 900, height: 2100, sill: 0 }],
    },
  ]
  floor.items = [{ id: 'i_1', catalogId: 'sofa-3', x: 1500, y: 1500, rotation: 90, locked: false }]
  return doc
}

describe('parseDoc', () => {
  it('JSON 왕복 후에도 동일한 문서를 돌려준다', () => {
    const doc = sampleDoc()
    const result = parseDoc(JSON.parse(JSON.stringify(doc)))
    expect(result).toEqual({ ok: true, doc })
  })

  it('빈 문서는 유효하다', () => {
    expect(parseDoc(createEmptyDoc()).ok).toBe(true)
  })

  it('객체가 아니면 실패한다', () => {
    expect(parseDoc(null).ok).toBe(false)
    expect(parseDoc('hello').ok).toBe(false)
  })

  it('schemaVersion이 없거나 더 높으면 실패한다', () => {
    const { schemaVersion: _, ...rest } = sampleDoc()
    expect(parseDoc(rest).ok).toBe(false)
    expect(parseDoc({ ...sampleDoc(), schemaVersion: 999 }).ok).toBe(false)
  })

  it('길이가 정수 mm가 아니면 경로와 함께 실패한다', () => {
    const doc = sampleDoc()
    doc.floors[0]!.corners[0]!.x = 12.5
    const result = parseDoc(doc)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('floors.0.corners.0.x')
  })
})
