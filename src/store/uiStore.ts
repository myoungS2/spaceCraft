import { create } from 'zustand'

export type EditorMode = 'draw' | 'furniture'
export type ViewMode = '2d' | '3d'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type Selection =
  | { kind: 'wall'; id: string }
  | { kind: 'corner'; id: string }
  | { kind: 'opening'; wallId: string; id: string }
  | { kind: 'room'; id: string }
  | { kind: 'item'; id: string }
  | null

/** 2D 뷰포트: 화면 px = 월드 mm * scale + (x, y) */
export interface Viewport {
  x: number
  y: number
  scale: number
}

/** 문서가 아닌 화면 상태. undo/redo 대상이 아니다. */
export interface UiState {
  mode: EditorMode
  view: ViewMode
  selection: Selection
  viewport: Viewport
  wallsTransparent: boolean
  saveStatus: SaveStatus
  /** 사용자에게 보여줄 오류(불러오기 실패 등) */
  banner: string | null
  setMode: (mode: EditorMode) => void
  setView: (view: ViewMode) => void
  select: (selection: Selection) => void
  setViewport: (viewport: Viewport) => void
  toggleWallsTransparent: () => void
  setSaveStatus: (status: SaveStatus) => void
  setBanner: (banner: string | null) => void
}

export const useUiStore = create<UiState>()((set) => ({
  mode: 'draw',
  view: '2d',
  selection: null,
  // 기본 0.1 → 1px = 10mm
  viewport: { x: 80, y: 80, scale: 0.1 },
  wallsTransparent: false,
  saveStatus: 'idle',
  banner: null,
  setMode: (mode) => set({ mode, selection: null }),
  setView: (view) => set({ view }),
  select: (selection) => set({ selection }),
  setViewport: (viewport) => set({ viewport }),
  toggleWallsTransparent: () => set((s) => ({ wallsTransparent: !s.wallsTransparent })),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setBanner: (banner) => set({ banner }),
}))
