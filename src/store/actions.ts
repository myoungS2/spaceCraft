import { addItem, deleteItem, duplicateItem, rotateItemBy } from '../geometry/items'
import { deleteOpening, findOpening } from '../geometry/openings'
import { snapToGrid } from '../geometry/snap'
import type { Vec } from '../geometry/vec'
import { deleteCorner, deleteWall } from '../geometry/walls'
import { deserializeDoc, exportFileName, serializeDoc } from '../model/io'
import type { Floor } from '../model/schema'
import { docHistory, isInGesture, selectFloor, useDocStore } from './docStore'
import { useUiStore, type Selection } from './uiStore'

/** 문서와 UI 상태를 함께 다루는 편집 명령. 키보드 단축키와 패널 버튼이 같이 쓴다. */
export function deleteSelection() {
  const { selection, select } = useUiStore.getState()
  if (!selection) return
  const { updateFloor } = useDocStore.getState()
  switch (selection.kind) {
    case 'wall':
      updateFloor((f) => deleteWall(f, selection.id))
      break
    case 'corner':
      updateFloor((f) => deleteCorner(f, selection.id))
      break
    case 'opening':
      updateFloor((f) => {
        const found = findOpening(f, selection.id)
        return found ? deleteOpening(f, found.wall.id, selection.id) : f
      })
      break
    case 'item':
      updateFloor((f) => deleteItem(f, selection.id))
      break
    default:
      // 방은 벽에서 자동 생성되므로 직접 지우지 않는다.
      return
  }
  select(null)
}

/** 카탈로그 가구를 at(없으면 2D 화면 가운데)에 놓고 선택한다. 가구 모드로 바꾼다. */
export function placeCatalogItem(catalogId: string, at?: Vec) {
  const ui = useUiStore.getState()
  const grid = useDocStore.getState().doc.settings.gridSnap
  const { viewport: vp, canvasSize } = ui
  const target = at ?? {
    x: (canvasSize.width / 2 - vp.x) / vp.scale,
    y: (canvasSize.height / 2 - vp.y) / vp.scale,
  }
  const r = addItem(selectFloor(useDocStore.getState()), catalogId, {
    x: snapToGrid(target.x, grid),
    y: snapToGrid(target.y, grid),
  })
  useDocStore.getState().updateFloor(() => r.floor)
  if (ui.mode !== 'furniture') ui.setMode('furniture')
  useUiStore.getState().select({ kind: 'item', id: r.itemId })
}

export function rotateSelectedItem(step: number) {
  const { selection } = useUiStore.getState()
  if (selection?.kind !== 'item') return
  useDocStore.getState().updateFloor((f) => rotateItemBy(f, selection.id, step))
}

export function duplicateSelectedItem() {
  const { selection, select } = useUiStore.getState()
  if (selection?.kind !== 'item') return
  const r = duplicateItem(selectFloor(useDocStore.getState()), selection.id)
  if (!r.itemId) return
  useDocStore.getState().updateFloor(() => r.floor)
  select({ kind: 'item', id: r.itemId })
}

/** 현재 문서를 JSON 파일로 내려받는다. */
export function exportDocFile() {
  const blob = new Blob([serializeDoc(useDocStore.getState().doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFileName()
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * JSON 파일을 검증(migrate + zod)한 뒤 현재 문서를 바꾼다.
 * 히스토리에 남기므로 실행취소로 불러오기 전 도면으로 돌아갈 수 있다.
 */
export async function importDocFile(file: File): Promise<boolean> {
  const ui = useUiStore.getState()
  const result = deserializeDoc(await file.text())
  if (!result.ok) {
    ui.setBanner(`"${file.name}"을(를) 불러오지 못했습니다. ${result.error}`)
    return false
  }
  ui.select(null)
  ui.setBanner(null)
  useDocStore.getState().replaceDoc(result.doc)
  return true
}

/** 선택한 대상이 문서에 아직 있는지(실행취소로 사라졌을 수 있다) */
export function selectionExists(floor: Floor, selection: Selection): boolean {
  if (!selection) return true
  switch (selection.kind) {
    case 'wall':
      return floor.walls.some((w) => w.id === selection.id)
    case 'corner':
      return floor.corners.some((c) => c.id === selection.id)
    case 'opening':
      return findOpening(floor, selection.id) !== undefined
    case 'room':
      return floor.rooms.some((r) => r.id === selection.id)
    case 'item':
      return floor.items.some((i) => i.id === selection.id)
  }
}

function afterHistoryMove() {
  const { selection, select } = useUiStore.getState()
  if (!selectionExists(selectFloor(useDocStore.getState()), selection)) select(null)
}

/** 드래그 중에는 막는다(제스처 스냅샷과 섞이지 않도록). */
export function undo() {
  if (isInGesture()) return
  docHistory().undo()
  afterHistoryMove()
}

export function redo() {
  if (isInGesture()) return
  docHistory().redo()
  afterHistoryMove()
}
