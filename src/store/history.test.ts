import { addOpening, moveOpening, updateOpening } from '../geometry/openings'
import { addWall, deleteWall, setWallLength, updateWall } from '../geometry/walls'
import { createEmptyDoc } from '../model/defaults'
import { serializeDoc } from '../model/io'
import {
  deleteSelection,
  duplicateSelectedItem,
  importDocFile,
  placeCatalogItem,
  redo,
  rotateSelectedItem,
  undo,
} from './actions'
import { beginGesture, docHistory, endGesture, resetHistory, selectFloor, useDocStore } from './docStore'
import { useUiStore } from './uiStore'

const floor = () => selectFloor(useDocStore.getState())
const edit = useDocStore.getState().updateFloor

beforeEach(() => {
  useDocStore.getState().replaceDoc(createEmptyDoc())
  resetHistory()
  useUiStore.setState({ selection: null, mode: 'draw', banner: null })
})

/** 모든 종류의 편집을 한 번씩 한다. 각 편집은 히스토리 1건이어야 한다. */
function editEverything(): number {
  let steps = 0
  const step = (fn: () => void) => {
    const before = docHistory().pastStates.length
    fn()
    expect(docHistory().pastStates.length).toBe(before + 1)
    steps++
  }
  const pts = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
    { x: 0, y: 0 },
  ]
  for (let i = 0; i < 4; i++) step(() => edit((f) => addWall(f, pts[i]!, pts[i + 1]!, 200).floor)) // 방 생성 포함
  const wallId = () => floor().walls[0]!.id
  step(() => edit((f) => updateWall(f, wallId(), { thickness: 150 })))
  step(() => edit((f) => setWallLength(f, wallId(), 4500)))
  step(() => edit((f) => addOpening(f, wallId(), 'door', 1000).floor))
  const doorId = () => floor().walls[0]!.openings[0]!.id
  step(() => edit((f) => updateOpening(f, wallId(), doorId(), { swingReverse: true })))
  // 드래그 한 번(여러 프레임) = 1건
  step(() => {
    beginGesture()
    for (const x of [1100, 1200, 1300]) edit((f) => moveOpening(f, wallId(), doorId(), x))
    endGesture()
  })
  step(() => edit((f) => ({ ...f, rooms: f.rooms.map((r) => ({ ...r, name: '거실' })) })))
  step(() => placeCatalogItem('sofa-3', { x: 2000, y: 1500 }))
  step(() => rotateSelectedItem(15))
  step(() => duplicateSelectedItem())
  step(() => deleteSelection())
  step(() => useDocStore.getState().updateSettings({ gridSnap: 100 }))
  step(() => edit((f) => deleteWall(f, f.walls[1]!.id))) // 방 사라짐
  return steps
}

describe('undo/redo 전체', () => {
  it('모든 편집을 끝까지 되돌리고 다시 실행하면 같은 문서가 된다', () => {
    const empty = useDocStore.getState().doc
    const steps = editEverything()
    const final = useDocStore.getState().doc
    expect(final.floors[0]!.rooms).toHaveLength(0)

    for (let i = 0; i < steps; i++) undo()
    expect(useDocStore.getState().doc).toEqual(empty)
    expect(docHistory().pastStates).toHaveLength(0)

    for (let i = 0; i < steps; i++) redo()
    expect(useDocStore.getState().doc).toEqual(final)
  })

  it('중간 단계(문 추가 직후)로 돌아가면 방·문이 그 상태 그대로다', () => {
    editEverything()
    // 마지막 벽 삭제를 되돌리면 방이 다시 생기고 이름 '거실'이 남아 있다
    undo()
    expect(floor().rooms.map((r) => r.name)).toEqual(['거실'])
  })

  it('실행취소로 선택 대상이 사라지면 선택을 해제한다', () => {
    placeCatalogItem('bed-queen', { x: 0, y: 0 })
    expect(useUiStore.getState().selection?.kind).toBe('item')
    undo()
    expect(useUiStore.getState().selection).toBeNull()
  })

  it('드래그 중에는 실행취소가 막힌다', () => {
    edit((f) => addWall(f, { x: 0, y: 0 }, { x: 1000, y: 0 }, 200).floor)
    beginGesture()
    edit((f) => setWallLength(f, f.walls[0]!.id, 2000))
    undo()
    expect(floor().walls).toHaveLength(1)
    endGesture()
    undo()
    expect(floor().walls[0]!.id).toBeDefined()
    expect(docHistory().pastStates).toHaveLength(1)
  })
})

describe('불러오기', () => {
  it('유효한 파일은 문서를 바꾸고, 실행취소로 이전 문서로 돌아간다', async () => {
    edit((f) => addWall(f, { x: 0, y: 0 }, { x: 1000, y: 0 }, 200).floor)
    const before = useDocStore.getState().doc
    const other = createEmptyDoc()
    other.floors[0]!.name = '불러온 층'
    const ok = await importDocFile(new File([serializeDoc(other)], 'plan.json'))
    expect(ok).toBe(true)
    expect(floor().name).toBe('불러온 층')
    undo()
    expect(useDocStore.getState().doc).toEqual(before)
  })

  it('잘못된 파일은 문서를 그대로 두고 배너로 알린다', async () => {
    const before = useDocStore.getState().doc
    const ok = await importDocFile(new File(['not json'], 'broken.json'))
    expect(ok).toBe(false)
    expect(useDocStore.getState().doc).toBe(before)
    expect(useUiStore.getState().banner).toContain('broken.json')
  })
})
