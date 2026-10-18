import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { catalogEntry } from '../data/catalog'
import { itemDims } from '../geometry/items'
import type { Item } from '../model/schema'
import type { Selection } from '../store/uiStore'
import { COLORS } from './WallShapes'

/** 회전 핸들이 가구 위쪽 끝에서 떨어진 거리(화면 px) */
export const ROTATE_HANDLE_PX = 22

interface Props {
  items: Item[]
  selection: Selection
  px: number
  interactive: boolean
}

/** 2D 가구: 회전된 바운딩박스 + 이름. 선택되면 회전 핸들을 보여준다. */
export function ItemShapes({ items, selection, px, interactive }: Props) {
  return (
    <Group listening={interactive} opacity={interactive ? 1 : 0.6}>
      {items.map((item) => {
        const entry = catalogEntry(item.catalogId)
        const { width, depth } = itemDims(item, entry)
        const selected = selection?.kind === 'item' && selection.id === item.id
        const fontSize = Math.min(12 * px, depth / 3, width / 4)
        const handleY = -depth / 2 - ROTATE_HANDLE_PX * px
        return (
          <Group key={item.id} x={item.x} y={item.y} rotation={item.rotation}>
            <Rect
              id={item.id}
              name="item"
              x={-width / 2}
              y={-depth / 2}
              width={width}
              height={depth}
              fill={selected ? 'rgba(238,237,255,0.92)' : 'rgba(255,255,255,0.85)'}
              stroke={selected ? COLORS.selected : '#77759c'}
              strokeWidth={(selected ? 2 : 1) * px}
              dash={item.locked ? [5 * px, 3 * px] : undefined}
            />
            {/* 앞쪽(깊이 +방향) 표시: 가구가 어느 쪽을 향하는지 */}
            <Line
              points={[-width / 2, depth / 2 - 3 * px, width / 2, depth / 2 - 3 * px]}
              stroke={selected ? COLORS.selected : '#a9a6cc'}
              strokeWidth={2 * px}
              listening={false}
            />
            <Text
              x={-width / 2}
              y={-fontSize / 2}
              width={width}
              align="center"
              text={item.locked ? `🔒 ${entry.name}` : entry.name}
              fontSize={fontSize}
              fill="#2b2a4a"
              listening={false}
            />
            {selected && !item.locked && (
              <>
                <Line points={[0, -depth / 2, 0, handleY]} stroke={COLORS.selected} strokeWidth={px} listening={false} />
                <Circle
                  id={item.id}
                  name="item-rotate"
                  y={handleY}
                  radius={6 * px}
                  fill="#fff"
                  stroke={COLORS.selected}
                  strokeWidth={1.5 * px}
                  hitStrokeWidth={8 * px}
                />
              </>
            )}
          </Group>
        )
      })}
    </Group>
  )
}
