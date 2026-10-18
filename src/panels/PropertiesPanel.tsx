import { selectFloor, useDocStore } from '../store/docStore'
import { useUiStore } from '../store/uiStore'
import { NumberField } from './NumberField'
import { TextField } from './TextField'

export function PropertiesPanel() {
  const selection = useUiStore((s) => s.selection)

  return (
    <aside className="panel right">
      <h2 className="panel-title">속성</h2>
      <div className="panel-body">{selection ? <p className="muted">선택: {selection.kind}</p> : <FloorProps />}</div>
    </aside>
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
