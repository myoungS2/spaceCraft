import { create } from 'zustand'
import { temporal } from 'zundo'
import { clampOpenings } from '../geometry/openings'
import { syncRooms } from '../geometry/rooms'
import { createEmptyDoc } from '../model/defaults'
import type { Doc, Floor, Settings } from '../model/schema'

/**
 * 진실원천인 도면 문서 store. 모든 편집은 여기 액션을 거쳐 불변 업데이트한다.
 * undo/redo(zundo)는 이 store의 doc만 추적한다. UI 상태는 uiStore에 둔다.
 */
export interface DocState {
  doc: Doc
  /** 불러오기/복원 등 문서 전체 교체. 히스토리는 호출 측에서 비운다(resetHistory). */
  replaceDoc: (doc: Doc) => void
  /** 현재 층(MVP는 floors[0])을 불변 업데이트한다. 벽 구조가 바뀌면 rooms를 자동으로 다시 계산한다. */
  updateFloor: (recipe: (floor: Floor) => Floor) => void
  updateSettings: (patch: Partial<Settings>) => void
}

export const useDocStore = create<DocState>()(
  temporal(
    (set) => ({
      doc: createEmptyDoc(),
      // 불러온 문서도 rooms를 벽 구조에 맞춰 둔다(이전 버전에서 저장된 문서 대비).
      replaceDoc: (doc) => set({ doc: { ...doc, floors: doc.floors.map((f) => syncRooms(f, f)) } }),
      updateFloor: (recipe) =>
        set((s) => {
          const [first, ...rest] = s.doc.floors
          if (!first) return s
          // 같은 set 안에서 파생 규칙을 적용한다(히스토리 1건):
          // 벽 구조가 바뀌면 rooms 재계산, 벽이 짧아지면 개구부를 벽 안으로 되돌림.
          const next = clampOpenings(syncRooms(first, recipe(first)))
          if (next === first) return s
          return { doc: { ...s.doc, floors: [next, ...rest] } }
        }),
      updateSettings: (patch) =>
        set((s) => ({ doc: { ...s.doc, settings: { ...s.doc.settings, ...patch } } })),
    }),
    {
      partialize: (s) => ({ doc: s.doc }),
      // 참조가 같으면 변경 없음 → 히스토리에 쌓지 않는다.
      equality: (a, b) => a.doc === b.doc,
      limit: 200,
    },
  ),
)

export const docHistory = () => useDocStore.temporal.getState()

export function resetHistory() {
  gestureSnapshot = undefined
  useDocStore.temporal.getState().clear()
}

/*
 * 제스처(드래그 등) 하나를 히스토리 1건으로 묶는다.
 * 시작 시 문서를 기억하고 기록을 멈춘다 → 종료 시 시작 문서로 잠깐 되돌린 뒤 기록을 재개하고
 * 최종 문서를 다시 set 하면, zundo에는 "시작 → 최종" 한 건만 남는다.
 */
let gestureSnapshot: Doc | undefined

export function beginGesture() {
  if (gestureSnapshot) return
  gestureSnapshot = useDocStore.getState().doc
  useDocStore.temporal.getState().pause()
}

export function endGesture() {
  const snapshot = gestureSnapshot
  if (!snapshot) return
  gestureSnapshot = undefined
  const final = useDocStore.getState().doc
  const temporalApi = useDocStore.temporal.getState()
  if (final === snapshot) {
    temporalApi.resume()
    return
  }
  useDocStore.setState({ doc: snapshot })
  temporalApi.resume()
  useDocStore.setState({ doc: final })
}

/** 제스처를 취소하고 시작 시점 문서로 되돌린다(히스토리 변화 없음). */
export function cancelGesture() {
  const snapshot = gestureSnapshot
  if (!snapshot) return
  gestureSnapshot = undefined
  useDocStore.setState({ doc: snapshot })
  useDocStore.temporal.getState().resume()
}

export const isInGesture = () => gestureSnapshot !== undefined

/** 현재 편집 중인 층. MVP는 1층만 UI에 노출한다. */
export const selectFloor = (s: DocState): Floor => s.doc.floors[0]!
