import { useStore } from 'zustand'
import { docHistory, useDocStore } from '../store/docStore'
import { useUiStore, type SaveStatus } from '../store/uiStore'

const saveLabel: Record<SaveStatus, string> = {
  idle: '',
  saving: '저장 중…',
  saved: '자동저장됨',
  error: '저장 실패',
}

export function TopBar() {
  const canUndo = useStore(useDocStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useDocStore.temporal, (s) => s.futureStates.length > 0)
  const saveStatus = useUiStore((s) => s.saveStatus)
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)

  return (
    <header className="topbar">
      <div className="brand">spaceCraft</div>
      <div className="group">
        <button onClick={() => docHistory().undo()} disabled={!canUndo} title="실행취소 (Ctrl/Cmd+Z)">
          ↶ 실행취소
        </button>
        <button onClick={() => docHistory().redo()} disabled={!canRedo} title="다시실행 (Ctrl/Cmd+Shift+Z)">
          ↷ 다시실행
        </button>
      </div>
      <span className={`save-status ${saveStatus}`}>{saveLabel[saveStatus]}</span>
      <div className="spacer" />
      <div className="segmented" role="tablist" aria-label="보기 전환">
        <button role="tab" aria-selected={view === '2d'} onClick={() => setView('2d')}>
          2D
        </button>
        <button role="tab" aria-selected={view === '3d'} onClick={() => setView('3d')}>
          3D
        </button>
      </div>
    </header>
  )
}
