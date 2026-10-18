import { createEmptyDoc } from '../model/defaults'
import { beginGesture, cancelGesture, docHistory, endGesture, resetHistory, useDocStore } from './docStore'
import { initPersistence, LEGACY_STORAGE_KEYS, SAVE_DEBOUNCE_MS, STORAGE_KEY, type DocStorage } from './persistence'
import { useUiStore } from './uiStore'

function memoryStorage(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial))
  const storage: DocStorage = {
    get: async (k) => data.get(k),
    set: async (k, v) => void data.set(k, v),
  }
  return { data, storage }
}

const addCorner = (x: number) =>
  useDocStore.getState().updateFloor((f) => ({ ...f, corners: [...f.corners, { id: `c_${x}`, x, y: 0 }] }))

beforeEach(() => {
  useDocStore.getState().replaceDoc(createEmptyDoc())
  resetHistory()
  useUiStore.setState({ banner: null, saveStatus: 'idle' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('docStore 히스토리', () => {
  it('편집은 undo/redo 된다', () => {
    addCorner(100)
    addCorner(200)
    expect(useDocStore.getState().doc.floors[0]!.corners).toHaveLength(2)
    docHistory().undo()
    expect(useDocStore.getState().doc.floors[0]!.corners).toHaveLength(1)
    docHistory().redo()
    expect(useDocStore.getState().doc.floors[0]!.corners).toHaveLength(2)
  })

  it('제스처 안의 여러 변경은 히스토리 1건이 된다', () => {
    addCorner(1)
    beginGesture()
    addCorner(2)
    addCorner(3)
    addCorner(4)
    endGesture()
    expect(docHistory().pastStates).toHaveLength(2)
    docHistory().undo()
    expect(useDocStore.getState().doc.floors[0]!.corners).toHaveLength(1)
  })

  it('cancelGesture는 시작 문서로 되돌리고 히스토리를 남기지 않는다', () => {
    beginGesture()
    addCorner(2)
    cancelGesture()
    expect(useDocStore.getState().doc.floors[0]!.corners).toHaveLength(0)
    expect(docHistory().pastStates).toHaveLength(0)
  })

  it('변경 없는 updateFloor는 히스토리에 쌓이지 않는다', () => {
    useDocStore.getState().updateFloor((f) => f)
    expect(docHistory().pastStates).toHaveLength(0)
  })
})

describe('initPersistence', () => {
  it('저장된 문서를 복원하고 히스토리를 비운다', async () => {
    const saved = createEmptyDoc()
    saved.floors[0]!.name = '복원됨'
    const { storage } = memoryStorage({ [STORAGE_KEY]: saved })
    const stop = await initPersistence(storage)
    expect(useDocStore.getState().doc.floors[0]!.name).toBe('복원됨')
    expect(docHistory().pastStates).toHaveLength(0)
    stop()
  })

  it('새 키에 문서가 없으면 이름 바꾸기 전 키에서 복원한다', async () => {
    const saved = createEmptyDoc()
    saved.floors[0]!.name = '옛 이름'
    const { storage } = memoryStorage({ [LEGACY_STORAGE_KEYS[0]!]: saved })
    const stop = await initPersistence(storage)
    expect(useDocStore.getState().doc.floors[0]!.name).toBe('옛 이름')
    stop()
  })

  it('깨진 문서는 따로 보관하고 배너를 띄운다', async () => {
    const { data, storage } = memoryStorage({ [STORAGE_KEY]: { schemaVersion: 1, floors: 'oops' } })
    const stop = await initPersistence(storage)
    expect(useUiStore.getState().banner).toContain('불러오지 못해')
    expect([...data.keys()].some((k) => k.startsWith(`${STORAGE_KEY}:corrupt:`))).toBe(true)
    stop()
  })

  it('변경을 디바운스해서 한 번만 저장한다', async () => {
    vi.useFakeTimers()
    const { data, storage } = memoryStorage()
    const setSpy = vi.spyOn(storage, 'set')
    const stop = await initPersistence(storage)

    addCorner(1)
    addCorner(2)
    addCorner(3)
    expect(useUiStore.getState().saveStatus).toBe('saving')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(useUiStore.getState().saveStatus).toBe('saved')
    expect((data.get(STORAGE_KEY) as ReturnType<typeof createEmptyDoc>).floors[0]!.corners).toHaveLength(3)
    stop()
  })
})
