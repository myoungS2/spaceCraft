import { useMemo } from 'react'
import { Circle, Group, Line, Text } from 'react-konva'
import { add, distance, normalize, perp, scale, sub, type Vec } from '../geometry/vec'
import { pointInPolygon } from '../geometry/rooms'
import { footprintPolygon, wallFootprints } from '../geometry/wallJoints'
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
  // 접합부는 geometry/wallJoints가 이웃 벽과 맞물리게 자른 다각형으로 그린다.
  const footprints = useMemo(() => wallFootprints(segments), [segments])
  return (
    <Group listening={interactive}>
      {segments.map(({ wall, a, b }) => {
        const selected = selection?.kind === 'wall' && selection.id === wall.id
        const footprint = footprints.get(wall.id)
        return (
          <Line
            key={wall.id}
            id={wall.id}
            name="wall"
            points={footprint ? footprintPolygon(footprint).flatMap((p) => [p.x, p.y]) : wallPolygon(a, b, wall.thickness)}
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

/**
 * 치수선을 그릴 쪽. 한쪽에만 방이 있으면 방이 없는 쪽(바깥)으로 보낸다.
 * 정할 수 없으면 화면에서 시계 방향으로 그렸을 때의 바깥(-perp)을 쓴다.
 */
export function dimensionSide(a: Vec, b: Vec, thickness: number, rooms: readonly Vec[][]): 1 | -1 {
  const mid = scale(add(a, b), 0.5)
  const n = perp(normalize(sub(b, a)))
  const probe = thickness / 2 + 50
  const inRoom = (p: Vec) => rooms.some((poly) => pointInPolygon(p, poly))
  const plus = inRoom(add(mid, scale(n, probe)))
  const minus = inRoom(sub(mid, scale(n, probe)))
  if (plus && !minus) return -1
  if (minus && !plus) return 1
  return -1
}

/** 벽 한쪽에 평행한 치수선과 길이(mm) 라벨 */
export function DimensionLine({ a, b, thickness, px, side = -1 }: { a: Vec; b: Vec; thickness: number; px: number; side?: 1 | -1 }) {
  const len = distance(a, b)
  if (len / px < 40) return null
  const dir = normalize(sub(b, a))
  const n = scale(perp(dir), side)
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

export function DimensionLines({ segments, rooms, px }: { segments: WallSegment[]; rooms: readonly Vec[][]; px: number }) {
  return (
    <Group listening={false}>
      {segments.map(({ wall, a, b }) => (
        <DimensionLine
          key={wall.id}
          a={a}
          b={b}
          thickness={wall.thickness}
          px={px}
          side={dimensionSide(a, b, wall.thickness, rooms)}
        />
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
