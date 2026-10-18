import { Shape } from 'react-konva'
import type { Viewport } from '../store/uiStore'
import { visibleWorldRect } from './viewport'

const MIN_PX_SPACING = 8
const MAJOR_STEP = 1000

interface Props {
  viewport: Viewport
  width: number
  height: number
  gridSnap: number
}

/** 화면에 보이는 영역만 그리는 그리드. 보조선은 너무 촘촘하면 생략한다. */
export function Grid({ viewport, width, height, gridSnap }: Props) {
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const r = visibleWorldRect(viewport, width, height)
        const px = 1 / viewport.scale
        const drawLines = (step: number, color: string) => {
          ctx.beginPath()
          for (let x = Math.floor(r.minX / step) * step; x <= r.maxX; x += step) {
            ctx.moveTo(x, r.minY)
            ctx.lineTo(x, r.maxY)
          }
          for (let y = Math.floor(r.minY / step) * step; y <= r.maxY; y += step) {
            ctx.moveTo(r.minX, y)
            ctx.lineTo(r.maxX, y)
          }
          ctx.strokeStyle = color
          ctx.lineWidth = px
          ctx.stroke()
        }
        // 보조선: 스냅 간격의 배수 중 화면에서 8px 이상 벌어지는 가장 작은 간격
        let minor = gridSnap
        while (minor * viewport.scale < MIN_PX_SPACING && minor < MAJOR_STEP) minor *= 2
        if (minor < MAJOR_STEP) drawLines(minor, '#eceef2')
        if (MAJOR_STEP * viewport.scale >= MIN_PX_SPACING) drawLines(MAJOR_STEP, '#d5d9e0')
        // 원점 표시
        ctx.beginPath()
        ctx.arc(0, 0, 3 * px, 0, Math.PI * 2)
        ctx.fillStyle = '#b0b6c0'
        ctx.fill()
      }}
    />
  )
}
