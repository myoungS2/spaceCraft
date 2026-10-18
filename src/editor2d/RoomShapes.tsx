import { Group, Line, Text } from 'react-konva'
import { areaM2, centroid } from '../geometry/rooms'
import type { Vec } from '../geometry/vec'
import type { Room } from '../model/schema'
import type { Selection } from '../store/uiStore'
import { COLORS } from './WallShapes'

export interface RoomView {
  room: Room
  polygon: Vec[]
}

interface Props {
  rooms: RoomView[]
  selection: Selection
  px: number
  interactive: boolean
}

/** 방 바닥 면. 벽보다 아래에 그린다. */
export function RoomShapes({ rooms, selection, px, interactive }: Props) {
  return (
    <Group listening={interactive}>
      {rooms.map(({ room, polygon }) => {
        const selected = selection?.kind === 'room' && selection.id === room.id
        return (
          <Line
            key={room.id}
            id={room.id}
            name="room"
            points={polygon.flatMap((p) => [p.x, p.y])}
            closed
            fill={room.floorColor}
            stroke={selected ? COLORS.selected : undefined}
            strokeWidth={selected ? 2 * px : 0}
            dash={selected ? [6 * px, 4 * px] : undefined}
          />
        )
      })}
    </Group>
  )
}

/** 방 이름과 면적. 벽 위에 겹쳐도 읽히도록 가장 위 레이어에 그린다. */
export function RoomLabels({ rooms, px }: { rooms: RoomView[]; px: number }) {
  const width = 160 * px
  const fontSize = 12 * px
  return (
    <Group listening={false}>
      {rooms.map(({ room, polygon }) => {
        const c = centroid(polygon)
        return (
          <Text
            key={room.id}
            x={c.x}
            y={c.y}
            width={width}
            offsetX={width / 2}
            offsetY={fontSize * 1.1}
            align="center"
            text={`${room.name}\n${areaM2(polygon).toFixed(1)}m²`}
            fontSize={fontSize}
            lineHeight={1.2}
            fill="#3b3a8f"
          />
        )
      })}
    </Group>
  )
}
