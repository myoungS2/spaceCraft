import { catalogEntry, entryShape, fullCatalog } from '../data/catalog'
import { createCustomFurniture, isCustomFurnitureInUse, removeCustomFurniture } from './customCatalog'
import { createEmptyDoc } from './defaults'
import { parseDoc } from './migrate'
import type { CustomFurniture } from './schema'

const input = { name: ' 2인용 소파 ', category: '소파', width: 1600.4, depth: 900, height: 850 }

function created(): CustomFurniture {
  const r = createCustomFurniture(input)
  if (!r.ok) throw new Error(r.error)
  return r.entry
}

describe('createCustomFurniture', () => {
  it('이름을 다듬고 치수를 정수 mm로 만든다', () => {
    const e = created()
    expect(e).toMatchObject({ name: '2인용 소파', category: '소파', width: 1600, depth: 900, height: 850 })
    expect(e.id.startsWith('f_')).toBe(true)
  })

  it('원형이면 shape를 남기고, 사각형이면 생략한다', () => {
    const round = createCustomFurniture({ ...input, shape: 'round' })
    expect(round.ok && round.entry.shape).toBe('round')
    const box = createCustomFurniture({ ...input, shape: 'box' })
    expect(box.ok && 'shape' in box.entry).toBe(false)
  })

  it('빈 이름·카테고리, 0 이하·숫자 아닌 치수는 거부한다', () => {
    expect(createCustomFurniture({ ...input, name: '  ' }).ok).toBe(false)
    expect(createCustomFurniture({ ...input, category: '' }).ok).toBe(false)
    expect(createCustomFurniture({ ...input, width: 0 }).ok).toBe(false)
    expect(createCustomFurniture({ ...input, height: Number.NaN }).ok).toBe(false)
  })
})

describe('removeCustomFurniture', () => {
  it('쓰이지 않으면 지우고, 도면에 놓여 있으면 같은 목록을 돌려준다', () => {
    const e = created()
    const doc = { ...createEmptyDoc(), customCatalog: [e] }
    expect(removeCustomFurniture(doc.customCatalog, doc, e.id)).toEqual([])

    doc.floors[0]!.items = [{ id: 'i_1', catalogId: e.id, x: 0, y: 0, rotation: 0, locked: false }]
    expect(isCustomFurnitureInUse(doc, e.id)).toBe(true)
    expect(removeCustomFurniture(doc.customCatalog, doc, e.id)).toBe(doc.customCatalog)
  })

  it('없는 id는 같은 목록', () => {
    const doc = createEmptyDoc()
    expect(removeCustomFurniture(doc.customCatalog, doc, 'nope')).toBe(doc.customCatalog)
  })
})

describe('카탈로그 조회', () => {
  it('사용자 가구는 기본 카탈로그 뒤에 붙고 id로 찾을 수 있다', () => {
    const e = created()
    const all = fullCatalog([e])
    expect(all.at(-1)).toMatchObject({ id: e.id, name: '2인용 소파' })
    expect(catalogEntry(e.id, [e]).width).toBe(1600)
    expect(catalogEntry(e.id).name).toBe('알 수 없는 가구')
  })

  it('기본 카탈로그에 원형·타원형 식탁이 있다', () => {
    expect(entryShape(catalogEntry('table-round'))).toBe('round')
    const oval = catalogEntry('table-oval')
    expect(entryShape(oval)).toBe('round')
    expect(oval.width).not.toBe(oval.depth)
    expect(entryShape(catalogEntry('sofa-3'))).toBe('box')
  })
})

describe('migrate v1 → v2', () => {
  it('v1 문서에 빈 customCatalog를 넣는다', () => {
    const { customCatalog: _, ...v2 } = createEmptyDoc()
    const r = parseDoc({ ...v2, schemaVersion: 1 })
    expect(r.ok && r.doc.customCatalog).toEqual([])
    expect(r.ok && r.doc.schemaVersion).toBe(2)
  })

  it('사용자 가구가 든 문서도 JSON 왕복 후 그대로', () => {
    const doc = { ...createEmptyDoc(), customCatalog: [created()] }
    expect(parseDoc(JSON.parse(JSON.stringify(doc)))).toEqual({ ok: true, doc })
  })
})
