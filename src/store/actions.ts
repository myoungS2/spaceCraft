import { deleteOpening, findOpening } from '../geometry/openings'
import { deleteCorner, deleteWall } from '../geometry/walls'
import { useDocStore } from './docStore'
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
    default:
      // 방은 벽에서 자동 생성되므로 직접 지우지 않는다. 가구 삭제는 6단계에서 추가한다.
      return
  }
  select(null)
}
