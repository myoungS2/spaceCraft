import { areaM2, ROOM_COLORS, roomPolygon } from '../geometry/rooms'
import { getSegment, moveCorner, setWallLength, updateWall } from '../geometry/walls'
import { distance } from '../geometry/vec'
import { deleteSelection } from '../store/actions'
import { selectFloor, useDocStore } from '../store/docStore'
import type { Room } from '../model/schema'
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
