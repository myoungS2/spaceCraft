import { lazy, Suspense } from 'react'
import { useUiStore } from '../store/uiStore'
import { Editor2D } from './Editor2D'

// three.js는 크기가 커서 3D로 처음 전환할 때 불러온다.
const Viewer3D = lazy(() => import('../viewer3d/Viewer3D'))

/** 중앙 캔버스. 2D는 Konva 편집기, 3D는 R3F 뷰. 둘 다 같은 문서를 그린다. */
export function CanvasArea() {
  const view = useUiStore((s) => s.view)
  if (view === '2d') return <Editor2D />
  return (
    <Suspense fallback={<div className="canvas-placeholder">3D 뷰 불러오는 중…</div>}>
      <Viewer3D />
    </Suspense>
  )
}
