import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Layer, Line, Stage } from 'react-konva'
import { addOpening, moveOpening, OPENING_DEFAULTS, placeOpening } from '../geometry/openings'
import { roomPolygon } from '../geometry/rooms'
import { snapPoint, snapToGrid, type SnapOptions, type SnapResult } from '../geometry/snap'
import { add, dot, normalize, perp, projectOnSegment, scale, sub, type Vec } from '../geometry/vec'
import {
  addWall,
  getSegment,
  mergeCorners,
  moveCorner,
  moveCorners,
  segmentLength,
  wallSegments,
  type PointRef,
  type WallSegment,
} from '../geometry/walls'
import { isTypingTarget } from '../hooks/useShortcuts'
import { DEFAULT_WALL_THICKNESS } from '../model/defaults'
import type { Floor, OpeningType } from '../model/schema'
import { beginGesture, cancelGesture, endGesture, selectFloor, useDocStore } from '../store/docStore'
import { useUiStore } from '../store/uiStore'
import { Grid } from './Grid'
import { OpeningGlyph, OpeningShapes } from './OpeningShapes'
import { RoomLabels, RoomShapes, type RoomView } from './RoomShapes'
import { useElementSize } from './useElementSize'
import { screenToWorld, zoomAt } from './viewport'
import { COLORS, CornerHandles, DimensionLine, DimensionLines, WallShapes, wallPolygon } from './WallShapes'

/** 꼭짓점·벽 스냅 허용 거리(화면 px) */
const SNAP_PX = 10
const ZOOM_SPEED = 0.0015

/** 마우스를 누른 뒤 놓을 때까지 window에서 이벤트를 받는 진행 중 조작 */
interface DragSession {
  move: (world: Vec, e: MouseEvent) => void
  up: () => void
  cancel: () => void
}

interface DrawState {
  start: PointRef
  /** 연속 그리기의 첫 corner. 다시 클릭하면 루프를 닫고 종료한다. */
  firstCornerId?: string
}

const snapColor: Record<SnapResult['kind'], string> = {
  corner: '#e8590c',
  wall: '#2b8a3e',
  grid: COLORS.selected,
}

/** 개구부 도구가 벽 위에 띄우는 미리보기 */
interface OpeningHover {
  wallId: string
  offset: number
  width: number
}

/** 커서 아래(벽 두께 + 허용 거리 안)의 가장 가까운 벽과, 벽 시작점부터 커서까지의 거리 */
function wallAt(segments: readonly WallSegment[], p: Vec, tolerance: number) {
  let best: { seg: WallSegment; along: number; dist: number } | undefined
  for (const seg of segments) {
    const proj = projectOnSegment(p, seg.a, seg.b)
    if (proj.t <= 0 || proj.t >= 1) continue
    if (proj.distance > seg.wall.thickness / 2 + tolerance) continue
    if (!best || proj.distance < best.dist) best = { seg, along: proj.t * segmentLength(seg), dist: proj.distance }
  }
  return best
}

const getFloor = () => selectFloor(useDocStore.getState())
const updateFloor = (recipe: (floor: Floor) => Floor) => useDocStore.getState().updateFloor(recipe)

export function Editor2D() {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const viewport = useUiStore((s) => s.viewport)
  const mode = useUiStore((s) => s.mode)
  const tool = useUiStore((s) => s.tool)
  const selection = useUiStore((s) => s.selection)
  const floor = useDocStore(selectFloor)
  const gridSnap = useDocStore((s) => s.doc.settings.gridSnap)
  const segments = useMemo(() => wallSegments(floor), [floor])
  const rooms = useMemo<RoomView[]>(() => {
    const corners = new Map(floor.corners.map((c) => [c.id, c]))
    return floor.rooms.map((room) => ({ room, polygon: roomPolygon(room, corners) }))
  }, [floor.rooms, floor.corners])
  const roomPolygons = useMemo(() => rooms.map((r) => r.polygon), [rooms])

  const [drawing, setDrawing] = useState<DrawState | null>(null)
  const [cursor, setCursor] = useState<SnapResult | null>(null)
  const [openingHover, setOpeningHover] = useState<OpeningHover | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const dragRef = useRef<DragSession | null>(null)

  const px = 1 / viewport.scale
  const wallToolActive = mode === 'draw' && tool === 'wall'
  const openingTool: OpeningType | null = mode === 'draw' && (tool === 'door' || tool === 'window') ? tool : null

  useEffect(() => {
    if (!wallToolActive) {
      setDrawing(null)
      setCursor(null)
    }
  }, [wallToolActive])

  useEffect(() => setOpeningHover(null), [openingTool])

  // Space(팬), ESC(그리기 종료)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceHeld(true)
      }
      if (e.key === 'Escape' && !dragRef.current) setDrawing(null)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const clientToWorld = (e: MouseEvent): Vec => {
    const rect = containerRef.current!.getBoundingClientRect()
    return screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, useUiStore.getState().viewport)
  }

  const snapOptions = (extra: Partial<SnapOptions> = {}): SnapOptions => {
    const f = getFloor()
    return {
      grid: useDocStore.getState().doc.settings.gridSnap,
      tolerance: SNAP_PX / useUiStore.getState().viewport.scale,
      corners: f.corners,
      walls: wallSegments(f),
      ...extra,
    }
  }

  /** 누른 상태의 조작을 window 이벤트로 이어 받는다(캔버스 밖으로 나가도 끊기지 않게). */
  const startDrag = (session: DragSession) => {
    const onMove = (e: MouseEvent) => session.move(clientToWorld(e), e)
    const onUp = () => {
      cleanup()
      session.up()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      cleanup()
      session.cancel()
    }
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
      dragRef.current = null
    }
    dragRef.current = session
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey)
  }

  const startPan = (e: MouseEvent) => {
    const origin = { x: e.clientX, y: e.clientY }
    const vp0 = useUiStore.getState().viewport
    setPanning(true)
    const stop = () => setPanning(false)
    startDrag({
      move: (_, ev) =>
        useUiStore.getState().setViewport({ ...vp0, x: vp0.x + ev.clientX - origin.x, y: vp0.y + ev.clientY - origin.y }),
      up: stop,
      cancel: stop,
    })
  }

  const handleWallClick = (world: Vec, shift: boolean) => {
    const snapped = snapPoint(world, snapOptions({ anchor: drawing?.start, ortho: shift }))
    if (!drawing) {
      setDrawing({ start: snapped })
      return
    }
    const before = getFloor()
    const r = addWall(before, drawing.start, snapped, DEFAULT_WALL_THICKNESS)
    if (r.startId === r.endId) return // 같은 점을 다시 클릭
    if (r.floor !== before) updateFloor(() => r.floor)

    const first = drawing.firstCornerId ?? r.startId
    if (r.endId === first) {
      setDrawing(null) // 시작점을 다시 클릭 → 닫고 종료
      return
    }
    const end = r.floor.corners.find((c) => c.id === r.endId)!
    setDrawing({ start: { x: end.x, y: end.y, cornerId: end.id }, firstCornerId: first })
  }

  /** 개구부 도구: 커서 아래 벽에 놓일 자리(클램프·겹침 회피 결과) */
  const openingPlacement = (world: Vec, type: OpeningType): OpeningHover | null => {
    const hit = wallAt(wallSegments(getFloor()), world, SNAP_PX / useUiStore.getState().viewport.scale)
    if (!hit) return null
    const len = segmentLength(hit.seg)
    const width = Math.min(OPENING_DEFAULTS[type].width, Math.floor(len))
    const desired = snapToGrid(hit.along, useDocStore.getState().doc.settings.gridSnap)
    const offset = placeOpening(len, hit.seg.wall.openings, { width }, desired)
    return offset === null ? null : { wallId: hit.seg.wall.id, offset, width }
  }

  const handleOpeningClick = (world: Vec, type: OpeningType) => {
    const place = openingPlacement(world, type)
    if (!place) return
    const r = addOpening(getFloor(), place.wallId, type, place.offset)
    if (!r.openingId) return
    updateFloor(() => r.floor)
    useUiStore.getState().select({ kind: 'opening', wallId: place.wallId, id: r.openingId })
    setOpeningHover(null)
  }

  /** 개구부를 잡은 지점을 유지하면서 벽을 따라 옮긴다. */
  const startOpeningDrag = (openingId: string, startWorld: Vec) => {
    const seg = wallSegments(getFloor()).find((s) => s.wall.openings.some((o) => o.id === openingId))
    const opening = seg?.wall.openings.find((o) => o.id === openingId)
    if (!seg || !opening) return
    const wallId = seg.wall.id
    useUiStore.getState().select({ kind: 'opening', wallId, id: openingId })
    const len = segmentLength(seg)
    const alongOf = (p: Vec) => projectOnSegment(p, seg.a, seg.b).t * len
    const grab = opening.offset - alongOf(startWorld)
    let moved = false
    startDrag({
      move: (world) => {
        const desired = snapToGrid(alongOf(world) + grab, useDocStore.getState().doc.settings.gridSnap)
        if (!moved && desired === opening.offset) return
        if (!moved) {
          moved = true
          beginGesture()
        }
        updateFloor((f) => moveOpening(f, wallId, openingId, desired))
      },
      up: () => moved && endGesture(),
      cancel: () => moved && cancelGesture(),
    })
  }

  const startCornerDrag = (cornerId: string) => {
    useUiStore.getState().select({ kind: 'corner', id: cornerId })
    let moved = false
    let last: SnapResult | undefined
    startDrag({
      move: (world) => {
        // 다른 꼭짓점에는 붙지만, 벽 위 스냅(T자 접합)은 아직 지원하지 않는다.
        last = snapPoint(world, snapOptions({ walls: [], excludeCornerIds: new Set([cornerId]) }))
        if (!moved) {
          moved = true
          beginGesture()
        }
        const target = last
        updateFloor((f) => moveCorner(f, cornerId, target))
      },
      up: () => {
        if (!moved) return
        const into = last?.cornerId
        if (into) {
          updateFloor((f) => mergeCorners(f, cornerId, into))
          useUiStore.getState().select({ kind: 'corner', id: into })
        }
        endGesture()
      },
      cancel: () => moved && cancelGesture(),
    })
  }

  const startWallDrag = (wallId: string, startWorld: Vec) => {
    useUiStore.getState().select({ kind: 'wall', id: wallId })
    const seg = getSegment(getFloor(), wallId)
    if (!seg) return
    const n = perp(normalize(sub(seg.b, seg.a)))
    const a0: Vec = { x: seg.a.x, y: seg.a.y }
    const b0: Vec = { x: seg.b.x, y: seg.b.y }
    let moved = false
    startDrag({
      move: (world) => {
        // 벽 방향과 수직으로만 움직인다(평행 이동). 이동 거리는 그리드 간격에 맞춘다.
        const d = snapToGrid(dot(sub(world, startWorld), n), useDocStore.getState().doc.settings.gridSnap)
        if (!moved && d === 0) return
        if (!moved) {
          moved = true
          beginGesture()
        }
        const offset = scale(n, d)
        updateFloor((f) =>
          moveCorners(
            f,
            new Map([
              [seg.a.id, add(a0, offset)],
              [seg.b.id, add(b0, offset)],
            ]),
          ),
        )
      },
      up: () => moved && endGesture(),
      cancel: () => moved && cancelGesture(),
    })
  }

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const evt = e.evt
    if (evt.button === 1 || (evt.button === 0 && spaceHeld)) {
      evt.preventDefault()
      startPan(evt)
      return
    }
    if (evt.button === 2) {
      setDrawing(null)
      return
    }
    if (evt.button !== 0) return
    const world = clientToWorld(evt)
    if (wallToolActive) {
      handleWallClick(world, evt.shiftKey)
      return
    }
    if (openingTool) {
      handleOpeningClick(world, openingTool)
      return
    }
    if (mode !== 'draw') {
      useUiStore.getState().select(null)
      return
    }
    const name = e.target.name()
    if (name === 'opening') startOpeningDrag(e.target.id(), world)
    else if (name === 'corner') startCornerDrag(e.target.id())
    else if (name === 'wall') startWallDrag(e.target.id(), world)
    else if (name === 'room') useUiStore.getState().select({ kind: 'room', id: e.target.id() })
    else useUiStore.getState().select(null)
  }

  const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (dragRef.current) return
    if (openingTool) {
      setOpeningHover(openingPlacement(clientToWorld(e.evt), openingTool))
      return
    }
    if (!wallToolActive) return
    setCursor(snapPoint(clientToWorld(e.evt), snapOptions({ anchor: drawing?.start, ortho: e.evt.shiftKey })))
  }

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const screen = { x: e.evt.clientX - rect.left, y: e.evt.clientY - rect.top }
    const { viewport: vp, setViewport } = useUiStore.getState()
    setViewport(zoomAt(vp, screen, Math.exp(-e.evt.deltaY * ZOOM_SPEED)))
  }

  const cursorStyle = panning
    ? 'grabbing'
    : spaceHeld
      ? 'grab'
      : wallToolActive || openingTool
        ? 'crosshair'
        : 'default'
  const hoverSeg = openingHover && segments.find((s) => s.wall.id === openingHover.wallId)

  return (
    <div ref={containerRef} className="editor2d" style={{ cursor: cursorStyle }} onContextMenu={(e) => e.preventDefault()}>
      {size.width > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={() => {
            setCursor(null)
            setOpeningHover(null)
          }}
          onWheel={onWheel}
        >
          <Layer listening={false}>
            <Grid viewport={viewport} width={size.width} height={size.height} gridSnap={gridSnap} />
          </Layer>
          <Layer>
            <RoomShapes rooms={rooms} selection={selection} px={px} interactive={mode === 'draw' && tool === 'select'} />
            <WallShapes segments={segments} selection={selection} px={px} interactive={mode === 'draw' && tool === 'select'} />
            <OpeningShapes segments={segments} selection={selection} px={px} interactive={mode === 'draw' && tool === 'select'} />
            <DimensionLines segments={segments} rooms={roomPolygons} px={px} />
            <RoomLabels rooms={rooms} px={px} />
            {mode === 'draw' && tool === 'select' && (
              <CornerHandles corners={floor.corners} selection={selection} px={px} />
            )}
          </Layer>
          <Layer listening={false}>
            {wallToolActive && <WallToolOverlay drawing={drawing} cursor={cursor} px={px} />}
            {openingTool && openingHover && hoverSeg && (
              <OpeningGlyph
                a={hoverSeg.a}
                b={hoverSeg.b}
                thickness={hoverSeg.wall.thickness}
                opening={{ type: openingTool, offset: openingHover.offset, width: openingHover.width }}
                px={px}
                color={COLORS.selected}
                opacity={0.7}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  )
}

function WallToolOverlay({ drawing, cursor, px }: { drawing: DrawState | null; cursor: SnapResult | null; px: number }) {
  const start = drawing?.start
  return (
    <Group>
      {start && cursor && (start.x !== cursor.x || start.y !== cursor.y) && (
        <>
          <Line points={wallPolygon(start, cursor, DEFAULT_WALL_THICKNESS)} closed fill={COLORS.preview} />
          <Line points={[start.x, start.y, cursor.x, cursor.y]} stroke={COLORS.selected} strokeWidth={px} dash={[4 * px, 4 * px]} />
          <DimensionLine a={start} b={cursor} thickness={DEFAULT_WALL_THICKNESS} px={px} />
        </>
      )}
      {start && <Circle x={start.x} y={start.y} radius={4 * px} fill={COLORS.selected} />}
      {cursor && (
        <Circle
          x={cursor.x}
          y={cursor.y}
          radius={(cursor.kind === 'grid' ? 3 : 6) * px}
          stroke={snapColor[cursor.kind]}
          strokeWidth={2 * px}
          fill={cursor.kind === 'grid' ? snapColor.grid : undefined}
        />
      )}
    </Group>
  )
}
