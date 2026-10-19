import { useRef } from 'react'
import { useStore } from 'zustand'
import { exportDocFile, importDocFile, redo, undo } from '../store/actions'
import { useDocStore } from '../store/docStore'
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
  const fileRef = useRef<HTMLInputElement>(null)

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    const ok = window.confirm(`"${file.name}"(으)로 현재 도면을 바꿀까요?\n실행취소로 되돌릴 수 있습니다.`)
    if (ok) await importDocFile(file)
  }

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/logo.svg" alt="" />
        <span className="brand-name">spacecraft</span>
        <span className="brand-tag">2D · 3D</span>
      </div>
      <div className="group">
        <button onClick={undo} disabled={!canUndo} title="실행취소 (Ctrl/Cmd+Z)">
          ↶ 실행취소
        </button>
        <button onClick={redo} disabled={!canRedo} title="다시실행 (Ctrl/Cmd+Shift+Z)">
          ↷ 다시실행
        </button>
      </div>
      <span className={`save-status ${saveStatus}`}>{saveLabel[saveStatus]}</span>
      <div className="group">
        <button onClick={exportDocFile} title="도면을 JSON 파일로 저장">
          내보내기
        </button>
        <button onClick={() => fileRef.current?.click()} title="JSON 파일에서 도면 불러오기">
          불러오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onPickFile(e.target.files?.[0])
            e.target.value = '' // 같은 파일을 다시 고를 수 있게
          }}
        />
      </div>
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
