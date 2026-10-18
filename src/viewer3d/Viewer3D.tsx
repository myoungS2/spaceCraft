import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DirectionalLight, Vector3 } from 'three'
import { roomPolygon } from '../geometry/rooms'
import { wallSegments } from '../geometry/walls'
import type { Corner } from '../model/schema'
import { selectFloor, useDocStore } from '../store/docStore'
import { useUiStore } from '../store/uiStore'
import { mmToM, planToWorld } from '../utils/coords'
import { FloorMesh, WallMesh } from './meshes'

/** 도면 범위(3D 좌표, m). 꼭짓점이 없으면 원점 주변 5m. */
interface Bounds {
  center: [number, number, number]
  radius: number
}

function planBounds(corners: readonly Corner[]): Bounds {
  if (corners.length === 0) return { center: planToWorld(2500, 2500), radius: 4 }
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    center: planToWorld((minX + maxX) / 2, (minY + maxY) / 2),
    radius: Math.max(2, mmToM(Math.hypot(maxX - minX, maxY - minY)) / 2),
  }
}

/** OrbitControls(makeDefault)에서 쓰는 부분만 */
interface OrbitLike {
  target: Vector3
  update: () => void
}

/** fitKey가 바뀔 때(처음 열 때, 버튼) 도면 전체가 보이도록 카메라를 옮긴다. */
function CameraFit({ bounds, fitKey }: { bounds: Bounds; fitKey: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null
  const size = useThree((s) => s.size)
  // 도면·화면 비율이 바뀔 때마다 다시 맞추면 사용자가 돌려 놓은 시점이 날아가므로 ref로만 읽는다.
  const latest = useRef({ bounds, aspect: 1 })
  latest.current = { bounds, aspect: size.width / Math.max(1, size.height) }

  useEffect(() => {
    if (!controls) return
    const { bounds: { center, radius }, aspect } = latest.current
    const [cx, , cz] = center
    // 도면을 감싸는 구가 세로·가로 시야 모두에 들어오는 거리
    const fov = 'fov' in camera ? ((camera.fov as number) * Math.PI) / 180 : Math.PI / 4
    const fit = radius / Math.sin(fov / 2)
    const distance = (aspect < 1 ? fit / aspect : fit) * 1.05
    const dir = { x: 0.5, y: 0.7, z: 0.8 }
    const len = Math.hypot(dir.x, dir.y, dir.z)
    camera.position.set(cx + (dir.x / len) * distance, (dir.y / len) * distance, cz + (dir.z / len) * distance)
    controls.target.set(cx, 0, cz)
    controls.update()
  }, [camera, controls, fitKey])

  return null
}

/** 그림자를 드리우는 해. 그림자 카메라를 도면 크기에 맞춘다. */
function SunLight({ bounds }: { bounds: Bounds }) {
  const ref = useRef<DirectionalLight>(null)
  const [cx, , cz] = bounds.center
  const r = bounds.radius + 2

  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.target.position.set(cx, 0, cz)
    light.target.updateMatrixWorld()
    const cam = light.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.far = r * 6
    cam.updateProjectionMatrix()
  }, [cx, cz, r])

  return (
    <directionalLight
      ref={ref}
      castShadow
      position={[cx - r, r * 2, cz + r * 0.8]}
      intensity={1.8}
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0005}
    />
  )
}

export default function Viewer3D() {
  const floor = useDocStore(selectFloor)
  const transparent = useUiStore((s) => s.wallsTransparent)
  const toggleTransparent = useUiStore((s) => s.toggleWallsTransparent)
  const [fitKey, setFitKey] = useState(0)

  const segments = useMemo(() => wallSegments(floor), [floor])
  const rooms = useMemo(() => {
    const corners = new Map(floor.corners.map((c) => [c.id, c]))
    return floor.rooms.map((room) => ({ room, polygon: roomPolygon(room, corners) }))
  }, [floor.rooms, floor.corners])
  const bounds = useMemo(() => planBounds(floor.corners), [floor.corners])

  return (
    <div className="viewer3d">
      <Canvas shadows camera={{ fov: 45, near: 0.05, far: 500, position: [8, 8, 8] }}>
        <color attach="background" args={['#eef1f5']} />
        <hemisphereLight args={['#ffffff', '#c3c8d0', 1.1]} />
        <SunLight bounds={bounds} />

        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#e2e5ea" roughness={1} />
        </mesh>

        {rooms.map(({ room, polygon }) => (
          <FloorMesh key={room.id} room={room} polygon={polygon} />
        ))}
        {segments.map(({ wall, a, b }) => (
          <WallMesh
            key={wall.id}
            wall={wall}
            a={a}
            b={b}
            height={wall.height ?? floor.height}
            transparent={transparent}
          />
        ))}

        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} minDistance={1} maxDistance={150} />
        <CameraFit bounds={bounds} fitKey={fitKey} />
      </Canvas>

      <div className="viewer3d-toolbar">
        <button aria-pressed={transparent} onClick={toggleTransparent}>
          벽 투명
        </button>
        <button onClick={() => setFitKey((k) => k + 1)}>시점 맞춤</button>
      </div>
      <div className="viewer3d-help">드래그: 회전 · 우클릭 드래그: 이동 · 휠: 줌</div>
    </div>
  )
}
