import { useEffect } from 'react'
import { deleteSelection, duplicateSelectedItem, redo, rotateSelectedItem, undo } from '../store/actions'
import { useUiStore } from '../store/uiStore'

/** 텍스트 입력 중에는 단축키를 무시한다. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === 'd') {
        e.preventDefault() // 브라우저 북마크 단축키 막기
        duplicateSelectedItem()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Escape') {
        useUiStore.getState().select(null)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelection()
        return
      }
      if (mod || e.altKey) return
      const ui = useUiStore.getState()
      if (key === 'r' && ui.selection?.kind === 'item') {
        rotateSelectedItem(e.shiftKey ? -15 : 15)
        return
      }
      if (ui.mode === 'draw' && key === 'v') ui.setTool('select')
      if (ui.mode === 'draw' && key === 'w') ui.setTool('wall')
      if (ui.mode === 'draw' && key === 'd') ui.setTool('door')
      if (ui.mode === 'draw' && key === 'n') ui.setTool('window')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
