import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useMemo } from 'react'
import { DoubleSide, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { catalogEntry } from '../data/catalog'
import { itemDims, moveItem, rotateItemTo, rotationByDrag } from '../geometry/items'
import { snapToGrid } from '../geometry/snap'
import type { Vec } from '../geometry/vec'
import type { Floor, Item } from '../model/schema'
import { beginGesture, cancelGesture, endGesture, selectFloor, useDocStore } from '../store/docStore'
import { useUiStore } from '../store/uiStore'
import { mmToM, planToWorld, worldToPlan } from '../utils/coords'
import { ItemModel } from './ItemModel'

const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const RING_COLOR = '#7b7ceb'
/** 회전 고리가 가구 바운딩박스 바깥으로 떨어진 거리(mm)와 굵기(mm) */
const RING_GAP = 150
const RING_WIDTH = 120

/** OrbitControls(makeDefault)에서 쓰는 부분만 */
interface ControlsLike {
  enabled: boolean
}

/**
 * 화면 포인터 위치를 바닥(높이 0) 평면에 투영해 2D 평면 좌표(mm)로 돌려준다.
 * 가구를 문서 좌표로 옮기기 위한 것이라 높이는 버린다.
 */
function useFloorPointer() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  return useMemo(() => {
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    const hit = new Vector3()
    return (clientX: number, clientY: number): Vec | null => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return raycaster.ray.intersectPlane(FLOOR_PLANE, hit) ? worldToPlan(hit.x, hit.z) : null
    }
  }, [camera, gl])
}

/**
 * 포인터를 누른 채 움직이는 동안 onMove를 평면 좌표로 부른다. 그동안 카메라 조작은 멈춘다.
 * 문서 변경은 onMove 쪽에서 첫 변경 때 beginGesture를 불러 드래그 하나를 히스토리 1건으로 묶는다.
 * 놓으면 endGesture, Esc를 누르면 cancelGesture로 시작 상태로 되돌린다.
 */
function useDragSession() {
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null
  const toPlan = useFloorPointer()
  return useCallback(
    (onMove: (p: Vec) => void) => {
      if (controls) controls.enabled = false
      const move = (ev: PointerEvent) => {
        const p = toPlan(ev.clientX, ev.clientY)
        if (p) onMove(p)
      }
      const finish = (cancel: boolean) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', abort)
        window.removeEventListener('keydown', key)
        if (controls) controls.enabled = true
        if (cancel) cancelGesture()
        else endGesture()
      }
      const up = () => finish(false)
      const abort = () => finish(true)
      const key = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') finish(true)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', abort)
      window.addEventListener('keydown', key)
    },
    [controls, toPlan],
  )
}

/** 첫 문서 변경 때만 제스처를 시작하는 updateFloor 래퍼 */
function gestureUpdater() {
  let started = false
  return (recipe: (floor: Floor) => Floor) => {
    if (!started) {
      // 바뀌는 게 없으면(스냅 범위 안 움직임) 히스토리를 건드리지 않는다.
      const floor = selectFloor(useDocStore.getState())
      if (recipe(floor) === floor) return
      started = true
      beginGesture()
    }
    useDocStore.getState().updateFloor(recipe)
  }
}

function selectItem(id: string) {
  const ui = useUiStore.getState()
  if (ui.mode !== 'furniture') ui.setMode('furniture')
  useUiStore.getState().select({ kind: 'item', id })
}

/**
 * 3D 가구들 + 상호작용. 클릭하면 선택(가구 모드로 전환), 끌면 바닥을 따라 이동(그리드 스냅),
 * 선택한 가구 둘레의 고리를 끌면 회전(15° 스냅). 편집은 2D와 같은 문서 함수를 쓰고 3D는 다시 그려질 뿐이다.
 */
export function Items3D({ items }: { items: Item[] }) {
  const selection = useUiStore((s) => s.selection)
  const startDrag = useDragSession()
  const toPlan = useFloorPointer()
  const selectedId = selection?.kind === 'item' ? selection.id : null
  const selected = items.find((i) => i.id === selectedId)

  const onItemDown = useCallback(
    (id: string, e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return
      // 회전 고리는 항상 위에 그려지므로 클릭도 고리가 먼저 가져간다.
      if (e.intersections.some((h) => h.object.userData.rotateRing)) return
      // 앞에 다른 물체(벽 등)가 있으면 그 뒤의 가구는 잡지 않는다.
      if (e.intersections[0]?.object !== e.object) return
      e.stopPropagation()
      selectItem(id)
      const item = selectFloor(useDocStore.getState()).items.find((i) => i.id === id)
      const start = toPlan(e.nativeEvent.clientX, e.nativeEvent.clientY)
      if (!item || item.locked || !start) return
      const origin = { x: item.x, y: item.y }
      const update = gestureUpdater()
      startDrag((p) => {
        const grid = useDocStore.getState().doc.settings.gridSnap
        const dx = snapToGrid(p.x - start.x, grid)
        const dy = snapToGrid(p.y - start.y, grid)
        update((f) => moveItem(f, id, { x: origin.x + dx, y: origin.y + dy }))
      })
    },
    [startDrag, toPlan],
  )

  const onRingDown = useCallback(
    (item: Item, e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0 || item.locked) return
      e.stopPropagation()
      const start = toPlan(e.nativeEvent.clientX, e.nativeEvent.clientY)
      if (!start) return
      const center = { x: item.x, y: item.y }
      const update = gestureUpdater()
      startDrag((p) => {
        update((f) => rotateItemTo(f, item.id, rotationByDrag(item.rotation, center, start, p)))
      })
    },
    [startDrag, toPlan],
  )

  return (
    <>
      {items.map((item) => (
        <ItemModel key={item.id} item={item} selected={item.id === selectedId} onPointerDown={onItemDown} />
      ))}
      {selected && !selected.locked && <RotateRing item={selected} onPointerDown={onRingDown} />}
    </>
  )
}

/** 선택한 가구 둘레 바닥에 그리는 회전 고리. 벽에 가려도 보이도록 깊이 검사를 끈다. */
function RotateRing({ item, onPointerDown }: { item: Item; onPointerDown: (item: Item, e: ThreeEvent<PointerEvent>) => void }) {
  const custom = useDocStore((s) => s.doc.customCatalog)
  const gl = useThree((s) => s.gl)
  const { width, depth } = itemDims(item, catalogEntry(item.catalogId, custom))
  const inner = Math.hypot(width, depth) / 2 + RING_GAP
  return (
    <mesh
      position={planToWorld(item.x, item.y, 5)}
      rotation-x={-Math.PI / 2}
      renderOrder={10}
      userData={{ rotateRing: true }}
      onPointerDown={(e) => onPointerDown(item, e)}
      onPointerOver={() => (gl.domElement.style.cursor = 'grab')}
      onPointerOut={() => (gl.domElement.style.cursor = '')}
    >
      <ringGeometry args={[mmToM(inner), mmToM(inner + RING_WIDTH), 64]} />
      <meshBasicMaterial color={RING_COLOR} transparent opacity={0.75} depthTest={false} side={DoubleSide} />
    </mesh>
  )
}
