import { useUiStore } from '../store/uiStore'
import { Editor2D } from './Editor2D'

/** 중앙 캔버스. 2D는 Konva 편집기, 3D는 5단계에서 R3F 뷰로 채운다. */
export function CanvasArea() {
  const view = useUiStore((s) => s.view)
  return view === '2d' ? <Editor2D /> : <div className="canvas-placeholder">3D 뷰 (5단계에서 구현)</div>
}
