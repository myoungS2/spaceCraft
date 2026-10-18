import { addItem, deleteItem, duplicateItem, rotateItemBy } from '../geometry/items'
import { deleteOpening, findOpening } from '../geometry/openings'
import { snapToGrid } from '../geometry/snap'
import type { Vec } from '../geometry/vec'
import { deleteCorner, deleteWall } from '../geometry/walls'
import { selectFloor, useDocStore } from './docStore'
import { useUiStore } from './uiStore'

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
