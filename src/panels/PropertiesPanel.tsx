import { findOpening, MIN_OPENING_WIDTH, updateOpening, wallHeight, type OpeningPatch } from '../geometry/openings'
import { areaM2, ROOM_COLORS, roomPolygon } from '../geometry/rooms'
import { getSegment, moveCorner, segmentLength, setWallLength, updateWall } from '../geometry/walls'
import { distance } from '../geometry/vec'
import { catalogEntry } from '../data/catalog'
import { itemDims, resetItemDims, updateItem, type ItemPatch } from '../geometry/items'
import { deleteSelection, duplicateSelectedItem } from '../store/actions'
import { selectFloor, useDocStore } from '../store/docStore'
import type { Opening, Room } from '../model/schema'
import { useUiStore } from '../store/uiStore'
import { ColorField } from './ColorField'
import { NumberField } from './NumberField'
import { TextField } from './TextField'

export function PropertiesPanel() {
  const selection = useUiStore((s) => s.selection)
  const floor = useDocStore(selectFloor)

  // 선택 대상이 undo 등으로 사라졌으면 층 속성을 보여준다.
  let body = <FloorProps />
  if (selection?.kind === 'wall' && floor.walls.some((w) => w.id === selection.id)) {
    body = <WallProps wallId={selection.id} />
  } else if (selection?.kind === 'corner' && floor.corners.some((c) => c.id === selection.id)) {
    body = <CornerProps cornerId={selection.id} />
  } else if (selection?.kind === 'opening' && findOpening(floor, selection.id)) {
    body = <OpeningProps openingId={selection.id} />
  } else if (selection?.kind === 'item' && floor.items.some((i) => i.id === selection.id)) {
    body = <ItemProps itemId={selection.id} />
  } else if (selection?.kind === 'room' && floor.rooms.some((r) => r.id === selection.id)) {
    body = <RoomProps roomId={selection.id} />
  }

  return (
    <aside className="panel right">
      <h2 className="panel-title">속성</h2>
      <div className="panel-body">{body}</div>
    </aside>
  )
}

function WallProps({ wallId }: { wallId: string }) {
  const floor = useDocStore(selectFloor)
  const updateFloor = useDocStore((s) => s.updateFloor)
  const seg = getSegment(floor, wallId)
  if (!seg) return null
  const { wall } = seg

  return (
    <>
      <h3>벽</h3>
      <NumberField
        label="길이 (시작점 고정, 끝점 이동)"
        value={Math.round(distance(seg.a, seg.b))}
        min={10}
        max={100000}
        onCommit={(len) => updateFloor((f) => setWallLength(f, wallId, len))}
      />
      <NumberField
        label="두께"
        value={wall.thickness}
        min={10}
        max={2000}
        onCommit={(thickness) => updateFloor((f) => updateWall(f, wallId, { thickness }))}
      />
      <NumberField
        label={wall.height === undefined ? '높이 (층 높이 따름)' : '높이'}
        value={wall.height ?? floor.height}
        min={100}
        max={10000}
        onCommit={(height) =>
          updateFloor((f) => updateWall(f, wallId, { height: height === f.height ? undefined : height }))
        }
      />
      <p className="muted">개구부 {wall.openings.length}개</p>
      <button className="danger" onClick={deleteSelection}>
        벽 삭제
      </button>
    </>
  )
}

function CornerProps({ cornerId }: { cornerId: string }) {
  const corner = useDocStore((s) => selectFloor(s).corners.find((c) => c.id === cornerId))
  const wallCount = useDocStore((s) => selectFloor(s).walls.filter((w) => w.start === cornerId || w.end === cornerId).length)
  const updateFloor = useDocStore((s) => s.updateFloor)
  if (!corner) return null

  return (
    <>
      <h3>꼭짓점</h3>
      <div className="field-row">
        <NumberField label="X" value={corner.x} onCommit={(x) => updateFloor((f) => moveCorner(f, cornerId, { x, y: corner.y }))} />
        <NumberField label="Y" value={corner.y} onCommit={(y) => updateFloor((f) => moveCorner(f, cornerId, { x: corner.x, y }))} />
      </div>
      <p className="muted">연결된 벽 {wallCount}개</p>
      <button className="danger" onClick={deleteSelection}>
        꼭짓점과 연결된 벽 삭제
      </button>
    </>
  )
}

function OpeningProps({ openingId }: { openingId: string }) {
  const floor = useDocStore(selectFloor)
  const updateFloor = useDocStore((s) => s.updateFloor)
  const found = findOpening(floor, openingId)
  const seg = found && getSegment(floor, found.wall.id)
  if (!found || !seg) return null
  const { wall, opening } = found
  const len = Math.floor(segmentLength(seg))
  const maxH = wallHeight(floor, wall)
  const patch = (p: OpeningPatch) => updateFloor((f) => updateOpening(f, wall.id, openingId, p))
  const isDoor = opening.type === 'door'

  return (
    <>
      <h3>{isDoor ? '문' : '창'}</h3>
      <label className="field">
        <span>종류</span>
        <select value={opening.type} onChange={(e) => patch({ type: e.target.value as Opening['type'] })}>
          <option value="door">문</option>
          <option value="window">창</option>
        </select>
      </label>
      <NumberField
        label="위치 (벽 시작점→중심)"
        value={opening.offset}
        min={Math.ceil(opening.width / 2)}
        max={Math.floor(len - opening.width / 2)}
        onCommit={(offset) => patch({ offset })}
      />
      <NumberField label="폭" value={opening.width} min={MIN_OPENING_WIDTH} max={len} onCommit={(width) => patch({ width })} />
      <div className="field-row">
        <NumberField label="높이" value={opening.height} min={100} max={maxH - opening.sill} onCommit={(height) => patch({ height })} />
        {!isDoor && (
          <NumberField label="바닥에서" value={opening.sill} min={0} max={maxH - 100} onCommit={(sill) => patch({ sill })} />
        )}
      </div>
      {isDoor && (
        <>
          <label className="check">
            <input type="checkbox" checked={!!opening.hingeAtEnd} onChange={(e) => patch({ hingeAtEnd: e.target.checked })} />
            경첩 위치 반대로
          </label>
          <label className="check">
            <input type="checkbox" checked={!!opening.swingReverse} onChange={(e) => patch({ swingReverse: e.target.checked })} />
            여는 방향 반대로
          </label>
        </>
      )}
      <p className="muted">벽 길이 {len}mm · 벽 높이 {maxH}mm</p>
      <button className="danger" onClick={deleteSelection}>
        {isDoor ? '문' : '창'} 삭제
      </button>
    </>
  )
}

function ItemProps({ itemId }: { itemId: string }) {
  const item = useDocStore((s) => selectFloor(s).items.find((i) => i.id === itemId))
  const updateFloor = useDocStore((s) => s.updateFloor)
  if (!item) return null
  const entry = catalogEntry(item.catalogId)
  const dims = itemDims(item, entry)
  const locked = item.locked
  const patch = (p: ItemPatch) => updateFloor((f) => updateItem(f, itemId, p))
  const customized = item.width !== undefined || item.depth !== undefined || item.height !== undefined

  return (
    <>
      <h3>가구</h3>
      <p className="readonly">
        {entry.name} <span className="muted">· {entry.category}</span>
      </p>
      <div className="field-row">
        <NumberField label="X" value={item.x} disabled={locked} onCommit={(x) => patch({ x })} />
        <NumberField label="Y" value={item.y} disabled={locked} onCommit={(y) => patch({ y })} />
      </div>
      <NumberField label="회전" unit="°" value={item.rotation} disabled={locked} onCommit={(rotation) => patch({ rotation })} />
      <div className="field-row">
        <NumberField label="폭 (W)" value={dims.width} min={10} max={20000} disabled={locked} onCommit={(width) => patch({ width })} />
        <NumberField label="깊이 (D)" value={dims.depth} min={10} max={20000} disabled={locked} onCommit={(depth) => patch({ depth })} />
      </div>
      <NumberField label="높이 (H)" value={dims.height} min={10} max={10000} disabled={locked} onCommit={(height) => patch({ height })} />
      {customized && !locked && (
        <button onClick={() => updateFloor((f) => resetItemDims(f, itemId))}>
          기본 치수로 ({entry.width}×{entry.depth}×{entry.height})
        </button>
      )}
      <label className="check">
        <input type="checkbox" checked={locked} onChange={(e) => patch({ locked: e.target.checked })} />
        잠금 (이동·회전·크기 변경 막기)
      </label>
      <div className="field-row">
        <button onClick={duplicateSelectedItem}>복제</button>
        <button className="danger" onClick={deleteSelection}>
          삭제
        </button>
      </div>
      {entry.license && entry.author !== 'placeholder' && (
        <p className="muted">
          모델: {entry.author} · {entry.license}
        </p>
      )}
    </>
  )
}

function RoomProps({ roomId }: { roomId: string }) {
  const floor = useDocStore(selectFloor)
  const updateFloor = useDocStore((s) => s.updateFloor)
  const room = floor.rooms.find((r) => r.id === roomId)
  if (!room) return null
  const polygon = roomPolygon(room, new Map(floor.corners.map((c) => [c.id, c])))
  const patch = (p: Partial<Room>) =>
    updateFloor((f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === roomId ? { ...r, ...p } : r)) }))

  return (
    <>
      <h3>방</h3>
      <TextField label="이름" value={room.name} onCommit={(name) => patch({ name })} />
      <div className="field">
        <span>바닥색</span>
        <ColorField value={room.floorColor} swatches={ROOM_COLORS} onCommit={(floorColor) => patch({ floorColor })} />
      </div>
      <div className="field">
        <span>면적</span>
        <strong className="readonly">{areaM2(polygon).toFixed(1)} m²</strong>
      </div>
      <p className="muted">방은 닫힌 벽으로 자동 생성되며, 벽을 지우면 함께 사라집니다.</p>
    </>
  )
}

/** 아무것도 선택하지 않았을 때: 층·프로젝트 설정 */
function FloorProps() {
  const floor = useDocStore(selectFloor)
  const gridSnap = useDocStore((s) => s.doc.settings.gridSnap)
  const updateFloor = useDocStore((s) => s.updateFloor)
  const updateSettings = useDocStore((s) => s.updateSettings)

  return (
    <>
      <h3>층</h3>
      <TextField label="이름" value={floor.name} onCommit={(name) => updateFloor((f) => ({ ...f, name }))} />
      <NumberField
        label="층 높이"
        value={floor.height}
        min={1000}
        max={10000}
        onCommit={(height) => updateFloor((f) => ({ ...f, height }))}
      />
      <h3>설정</h3>
      <NumberField
        label="그리드 스냅"
        value={gridSnap}
        min={1}
        max={1000}
        onCommit={(v) => updateSettings({ gridSnap: v })}
      />
      <p className="muted">
        벽 {floor.walls.length} · 방 {floor.rooms.length} · 가구 {floor.items.length}
      </p>
    </>
  )
}
