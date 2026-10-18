import { Circle, Group, Line, Text } from 'react-konva'
import { add, distance, normalize, perp, scale, sub, type Vec } from '../geometry/vec'
import type { WallSegment } from '../geometry/walls'
import type { Corner } from '../model/schema'
import type { Selection } from '../store/uiStore'

export const COLORS = {
  wallFill: '#c9ced6',
  wallStroke: '#5b6270',
  selected: '#2f6feb',
  selectedFill: '#b7cdf8',
  dim: '#7a818c',
  preview: 'rgba(47,111,235,0.35)',
}

/** 벽 중심선 a→b를 두께만큼 부풀린 사각형 꼭짓점 (Konva Line points 형식) */
export function wallPolygon(a: Vec, b: Vec, thickness: number): number[] {
  const n = scale(perp(normalize(sub(b, a))), thickness / 2)
  const p1 = add(a, n)
  const p2 = add(b, n)
  const p3 = sub(b, n)
  const p4 = sub(a, n)
  return [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]
}

interface WallsProps {
  segments: WallSegment[]
  selection: Selection
  /** 화면 1px에 해당하는 mm */
  px: number
  interactive: boolean
}

export function WallShapes({ segments, selection, px, interactive }: WallsProps) {
  // TODO(miter): 접합부는 사각형끼리 겹치게 둔다. 마이터 처리 미구현.
  return (
    <Group listening={interactive}>
      {segments.map(({ wall, a, b }) => {
        const selected = selection?.kind === 'wall' && selection.id === wall.id
        return (
          <Line
            key={wall.id}
            id={wall.id}
            name="wall"
            points={wallPolygon(a, b, wall.thickness)}
            closed
            fill={selected ? COLORS.selectedFill : COLORS.wallFill}
            stroke={selected ? COLORS.selected : COLORS.wallStroke}
            strokeWidth={px * (selected ? 2 : 1)}
            hitStrokeWidth={px * 8}
          />
        )
      })}
    </Group>
  )
}

/** 벽 한쪽에 평행한 치수선과 길이(mm) 라벨 */
export function DimensionLine({ a, b, thickness, px }: { a: Vec; b: Vec; thickness: number; px: number }) {
  const len = distance(a, b)
  if (len / px < 40) return null
  const dir = normalize(sub(b, a))
  // 화면에서 시계 방향으로 그린 방이면 바깥쪽. 3단계에서 방 기준으로 바깥 방향을 정한다.
  const n = scale(perp(dir), -1)
  const off = thickness / 2 + 14 * px
  const p1 = add(a, scale(n, off))
  const p2 = add(b, scale(n, off))
  const tick = scale(n, 4 * px)
  let angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI
  if (angle > 90 || angle <= -90) angle += 180
  const mid = scale(add(p1, p2), 0.5)
  const fontSize = 11 * px
  const labelWidth = 120 * px
  const label = add(mid, scale(n, 7 * px))
  return (
    <Group listening={false}>
      <Line points={[p1.x, p1.y, p2.x, p2.y]} stroke={COLORS.dim} strokeWidth={px} />
      <Line points={[p1.x - tick.x, p1.y - tick.y, p1.x + tick.x, p1.y + tick.y]} stroke={COLORS.dim} strokeWidth={px} />
      <Line points={[p2.x - tick.x, p2.y - tick.y, p2.x + tick.x, p2.y + tick.y]} stroke={COLORS.dim} strokeWidth={px} />
      <Text
        x={label.x}
        y={label.y}
        text={String(Math.round(len))}
        fontSize={fontSize}
        fill={COLORS.dim}
        width={labelWidth}
        align="center"
        offsetX={labelWidth / 2}
        offsetY={fontSize / 2}
        rotation={angle}
      />
    </Group>
  )
}

export function DimensionLines({ segments, px }: { segments: WallSegment[]; px: number }) {
  return (
    <Group listening={false}>
      {segments.map(({ wall, a, b }) => (
        <DimensionLine key={wall.id} a={a} b={b} thickness={wall.thickness} px={px} />
      ))}
    </Group>
  )
}

export function CornerHandles({ corners, selection, px }: { corners: Corner[]; selection: Selection; px: number }) {
  return (
    <Group>
      {corners.map((c) => {
        const selected = selection?.kind === 'corner' && selection.id === c.id
        return (
          <Circle
            key={c.id}
            id={c.id}
            name="corner"
            x={c.x}
            y={c.y}
            radius={(selected ? 6 : 5) * px}
            fill={selected ? COLORS.selected : '#fff'}
            stroke={COLORS.selected}
            strokeWidth={1.5 * px}
            hitStrokeWidth={6 * px}
          />
        )
      })}
    </Group>
  )
}
