import { create } from 'zustand'
import { temporal } from 'zundo'
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
  /** 현재 층(MVP는 floors[0])을 불변 업데이트한다. */
  updateFloor: (recipe: (floor: Floor) => Floor) => void
  updateSettings: (patch: Partial<Settings>) => void
}

export const useDocStore = create<DocState>()(
  temporal(
    (set) => ({
      doc: createEmptyDoc(),
      replaceDoc: (doc) => set({ doc }),
      updateFloor: (recipe) =>
        set((s) => {
          const [first, ...rest] = s.doc.floors
          if (!first) return s
          const next = recipe(first)
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
  useDocStore.temporal.getState().clear()
}

/** 현재 편집 중인 층. MVP는 1층만 UI에 노출한다. */
export const selectFloor = (s: DocState): Floor => s.doc.floors[0]!
