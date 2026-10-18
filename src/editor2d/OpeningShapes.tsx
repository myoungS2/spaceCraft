import { Group, Line, Shape } from 'react-konva'
import { add, normalize, perp, scale, sub, type Vec } from '../geometry/vec'
import type { WallSegment } from '../geometry/walls'
import type { Opening } from '../model/schema'
import type { Selection } from '../store/uiStore'
import { COLORS, wallPolygon } from './WallShapes'

const CUT_FILL = '#ffffff'
const LINE = '#3b3a8f'

/** 벽 중심선 위 개구부 양 끝점 */
export function openingSpan(a: Vec, b: Vec, offset: number, width: number): { s: Vec; e: Vec; dir: Vec; n: Vec } {
  const dir = normalize(sub(b, a))
  const center = add(a, scale(dir, offset))
  return { s: sub(center, scale(dir, width / 2)), e: add(center, scale(dir, width / 2)), dir, n: perp(dir) }
}

interface GlyphProps {
  a: Vec
  b: Vec
  thickness: number
  opening: Pick<Opening, 'type' | 'offset' | 'width' | 'hingeAtEnd' | 'swingReverse'>
  px: number
  color?: string
  opacity?: number
}

/** 문(열림 호)·창(이중선) 평면 기호. 벽을 하얗게 지우고 그 위에 그린다. */
export function OpeningGlyph({ a, b, thickness, opening, px, color = LINE, opacity = 1 }: GlyphProps) {
  const { s, e, dir, n } = openingSpan(a, b, opening.offset, opening.width)
  const half = thickness / 2
  const jamb = (p: Vec) => {
    const p1 = add(p, scale(n, half))
    const p2 = sub(p, scale(n, half))
    return [p1.x, p1.y, p2.x, p2.y]
  }

  if (opening.type === 'window') {
    const lineAt = (k: number) => {
      const o = scale(n, k)
      return [s.x + o.x, s.y + o.y, e.x + o.x, e.y + o.y]
    }
    return (
      <Group listening={false} opacity={opacity}>
        <Line points={wallPolygon(s, e, thickness + px)} closed fill={CUT_FILL} />
        <Line points={wallPolygon(s, e, thickness)} closed stroke={color} strokeWidth={px} />
        <Line points={lineAt(thickness / 6)} stroke={color} strokeWidth={px} />
        <Line points={lineAt(-thickness / 6)} stroke={color} strokeWidth={px} />
      </Group>
    )
  }

  // 문: 경첩(hinge) 쪽 벽면에서 문짝이 수직으로 열리고, 반대쪽 문틀까지 1/4 원호
  const side = opening.swingReverse ? -1 : 1
  const hinge = opening.hingeAtEnd ? e : s
  const other = opening.hingeAtEnd ? s : e
  const face = scale(n, side * half)
  const pivot = add(hinge, face)
  const leafEnd = add(pivot, scale(n, side * opening.width))
  const toOther = scale(dir, opening.hingeAtEnd ? -1 : 1)
  const start = Math.atan2(n.y * side, n.x * side)
  const end = Math.atan2(toOther.y, toOther.x)
  let delta = end - start
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta <= -Math.PI) delta += Math.PI * 2

  return (
    <Group listening={false} opacity={opacity}>
      <Line points={wallPolygon(s, e, thickness + px)} closed fill={CUT_FILL} />
      <Line points={jamb(s)} stroke={color} strokeWidth={px} />
      <Line points={jamb(e)} stroke={color} strokeWidth={px} />
      <Line points={[pivot.x, pivot.y, leafEnd.x, leafEnd.y]} stroke={color} strokeWidth={1.5 * px} />
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath()
          ctx.arc(pivot.x, pivot.y, opening.width, start, start + delta, delta < 0)
          ctx.strokeShape(shape)
        }}
        stroke={color}
        strokeWidth={px}
        dash={[4 * px, 3 * px]}
      />
      {/* 반대쪽 문틀의 벽면 점까지 닫힌 위치 표시 */}
      <Line points={[pivot.x, pivot.y, add(other, face).x, add(other, face).y]} stroke={color} strokeWidth={0.5 * px} opacity={0.4} />
    </Group>
  )
}

interface Props {
  segments: WallSegment[]
  selection: Selection
  px: number
  interactive: boolean
}

export function OpeningShapes({ segments, selection, px, interactive }: Props) {
  return (
    <Group>
      {segments.flatMap(({ wall, a, b }) =>
        wall.openings.map((o) => {
          const selected = selection?.kind === 'opening' && selection.id === o.id
          const { s, e } = openingSpan(a, b, o.offset, o.width)
          return (
            <Group key={o.id}>
              <OpeningGlyph a={a} b={b} thickness={wall.thickness} opening={o} px={px} color={selected ? COLORS.selected : LINE} />
              {/* 클릭·드래그용 투명 영역 */}
              <Line
                id={o.id}
                name="opening"
                points={wallPolygon(s, e, wall.thickness)}
                closed
                fill="rgba(0,0,0,0.001)"
                stroke={selected ? COLORS.selected : undefined}
                strokeWidth={selected ? 2 * px : 0}
                listening={interactive}
              />
            </Group>
          )
        }),
      )}
    </Group>
  )
}
