import { useUiStore } from '../store/uiStore'

/** 중앙 캔버스. 2단계에서 Konva 2D 편집기, 5단계에서 R3F 3D 뷰로 채운다. */
export function CanvasArea() {
  const view = useUiStore((s) => s.view)
  return (
    <div className="canvas-placeholder">
      {view === '2d' ? '2D 편집기 (2단계에서 구현)' : '3D 뷰 (5단계에서 구현)'}
    </div>
  )
}
