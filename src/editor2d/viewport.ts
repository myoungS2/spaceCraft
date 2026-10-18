import type { Vec } from '../geometry/vec'
import type { Viewport } from '../store/uiStore'

export const MIN_SCALE = 0.01
export const MAX_SCALE = 2

/** 화면 px → 월드 mm */
export const screenToWorld = (p: Vec, vp: Viewport): Vec => ({
  x: (p.x - vp.x) / vp.scale,
  y: (p.y - vp.y) / vp.scale,
})

/** 월드 mm → 화면 px */
export const worldToScreen = (p: Vec, vp: Viewport): Vec => ({
  x: p.x * vp.scale + vp.x,
  y: p.y * vp.scale + vp.y,
})

/** 화면의 한 점(커서)이 같은 월드 좌표를 가리키도록 유지하면서 확대/축소한다. */
export function zoomAt(vp: Viewport, screen: Vec, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor))
  const world = screenToWorld(screen, vp)
  return { scale, x: screen.x - world.x * scale, y: screen.y - world.y * scale }
}

/** 현재 화면에 보이는 월드 영역 */
export function visibleWorldRect(vp: Viewport, width: number, height: number) {
  const min = screenToWorld({ x: 0, y: 0 }, vp)
  const max = screenToWorld({ x: width, y: height }, vp)
  return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y }
}
