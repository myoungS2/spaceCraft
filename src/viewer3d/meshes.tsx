import { memo, useEffect, useMemo } from 'react'
import { DoubleSide, ExtrudeGeometry, Mesh, Path, Shape, ShapeGeometry, Vector2, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { footprintPolygon, splitFootprint, toWallLocal, type WallFootprint } from '../geometry/wallJoints'
import type { Vec } from '../geometry/vec'
import type { Corner, Opening, Room, Wall } from '../model/schema'
import { FLOOR_SHAPE_ROTATION_X, mmToM, planDirectionToWorldY, planToFloorShape, planToWorld } from '../utils/coords'
import { removeCollinear, wallOutline } from './wallOutline'

const WALL_COLOR = '#f7f5ff'
const GLASS_COLOR = '#cfe7ff'
/** 클릭(레이캐스트)을 받지 않게 한다. 투명 벽·유리 너머 가구를 잡을 수 있도록. */
const noRaycast = () => null

/** 위에서 본 다각형(벽 로컬 mm)을 높이만큼 세운다. 결과는 벽 로컬 m 좌표(x 벽 방향, y 높이, z 두께). */
function extrudePlan(polygon: readonly Vec[], height: number): ExtrudeGeometry {
  // Shape(XY)를 +Z로 밀고 X축 -90° 회전하면 (x, y, z) → (x, z, -y)가 되므로 y에 -로컬y를 넣는다.
  const shape = new Shape(removeCollinear(polygon).map((p) => new Vector2(mmToM(p.x), -mmToM(p.y))))
  const geometry = new ExtrudeGeometry(shape, { depth: mmToM(height), bevelEnabled: false })
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** 측면 외곽(개구부 포함)을 두께만큼 민다. x0은 이 조각이 시작하는 벽 로컬 x(mm). */
function extrudeSide(x0: number, length: number, height: number, thickness: number, openings: readonly Opening[]) {
  const shifted = openings.map((o) => ({ ...o, offset: o.offset - x0 }))
  const { outer, holes } = wallOutline(length, height, shifted)
  const toV2 = (p: Vec) => new Vector2(mmToM(p.x + x0), mmToM(p.y))
  const shape = new Shape(outer.map(toV2))
  for (const h of holes) shape.holes.push(new Path(h.map(toV2)))
  const depth = mmToM(thickness)
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

/**
 * 벽 지오메트리(벽 로컬 좌표). 접합부 모양은 위에서 본 footprint가 정하고, 개구부는 옆에서 본 외곽이 정한다.
 * - 개구부가 없으면 footprint 전체를 높이만큼 세운다(조각 하나, 내부 면 없음).
 * - 개구부가 있으면 footprint를 [접합부 조각 | 두께 일정한 가운데 | 접합부 조각]으로 나눠
 *   가운데만 기존 측면 Shape(문 notch·창 hole) 방식으로 만들고, 양 끝은 세워서 합친다.
 *   CSG 없이 두 방식을 이어 붙이는 대신, 접합부 조각과 겹치는 개구부 부분은 막힌다
 *   (꺾인 모서리 안쪽 두께/2 이내 — 이웃 벽 두께 안이라 실제로도 뚫릴 수 없는 자리).
 */
function buildWallGeometry(wall: Wall, a: Vec, b: Vec, height: number, footprint: WallFootprint): BufferGeometry {
  const local: WallFootprint = {
    start: footprint.start.map((p) => toWallLocal(p, a, b)),
    end: footprint.end.map((p) => toWallLocal(p, a, b)),
  }
  if (wall.openings.length === 0) return extrudePlan(footprintPolygon(local), height)

  const { core, ends } = splitFootprint(local, wall.thickness / 2)
  const parts: BufferGeometry[] = ends.map((poly) => extrudePlan(poly, height))
  if (core) parts.push(extrudeSide(core.x0, core.x1 - core.x0, height, wall.thickness, wall.openings))
  const merged = mergeGeometries(parts)
  for (const g of parts) g.dispose()
  return merged
}

const footprintKey = (f: WallFootprint) => [...f.start, ...f.end].map((p) => `${p.x},${p.y}`).join(';')

interface WallMeshProps {
  wall: Wall
  a: Corner
  b: Corner
  /** 이웃 벽과 맞물린 위에서 본 다각형(평면 mm, geometry/wallJoints) */
  footprint: WallFootprint
  height: number
  transparent: boolean
}

/**
 * 벽 하나. wall·corner 참조와 높이, 접합부 좌표가 그대로면 memo로 건너뛰어 바뀐 벽만 지오메트리를 다시 만든다.
 * 접합부는 이웃 벽 방향에도 달려 있으므로(이 벽 객체는 그대로여도) footprint는 좌표로 비교한다.
 */
export const WallMesh = memo(
  function WallMesh({ wall, a, b, footprint, height, transparent }: WallMeshProps) {
    const key = footprintKey(footprint)
    const geometry = useMemo(
      () => buildWallGeometry(wall, a, b, height, footprint),
      // footprint 배열 대신 좌표 문자열(key)로 비교한다.
      [wall, a, b, height, key],
    )
    useEffect(() => () => geometry.dispose(), [geometry])

    const windows = wall.openings.filter((o) => o.type === 'window')
    return (
      <group position={planToWorld(a.x, a.y)} rotation-y={planDirectionToWorldY(b.x - a.x, b.y - a.y)}>
        <mesh geometry={geometry} castShadow={!transparent} receiveShadow raycast={transparent ? noRaycast : Mesh.prototype.raycast}>
          <meshStandardMaterial
            color={WALL_COLOR}
            roughness={0.9}
            transparent={transparent}
            opacity={transparent ? 0.25 : 1}
            depthWrite={!transparent}
            side={DoubleSide}
          />
        </mesh>
        {windows.map((o) => (
          <mesh key={o.id} position={[mmToM(o.offset), mmToM(o.sill + o.height / 2), 0]} raycast={noRaycast}>
            <boxGeometry args={[mmToM(o.width), mmToM(o.height), mmToM(10)]} />
            <meshStandardMaterial color={GLASS_COLOR} transparent opacity={0.3} roughness={0.1} depthWrite={false} />
          </mesh>
        ))}
      </group>
    )
  },
  (p, n) =>
    p.wall === n.wall &&
    p.a === n.a &&
    p.b === n.b &&
    p.height === n.height &&
    p.transparent === n.transparent &&
    footprintKey(p.footprint) === footprintKey(n.footprint),
)

/** 방 바닥. 꼭짓점 좌표가 같으면 지오메트리를 재사용한다. */
export const FloorMesh = memo(function FloorMesh({ room, polygon }: { room: Room; polygon: Vec[] }) {
  const key = polygon.map((p) => `${p.x},${p.y}`).join(';')
  const geometry = useMemo(() => {
    const shape = new Shape(polygon.map((p) => new Vector2(...planToFloorShape(p.x, p.y))))
    return new ShapeGeometry(shape)
    // 의존성은 polygon 배열 대신 좌표 문자열(key)로 비교한다.
  }, [key])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} rotation-x={FLOOR_SHAPE_ROTATION_X} position-y={mmToM(2)} receiveShadow>
      <meshStandardMaterial color={room.floorColor} roughness={0.8} />
    </mesh>
  )
})
