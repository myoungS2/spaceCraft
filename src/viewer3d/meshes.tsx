import { memo, useEffect, useMemo } from 'react'
import { DoubleSide, ExtrudeGeometry, Path, Shape, ShapeGeometry, Vector2 } from 'three'
import { distance, type Vec } from '../geometry/vec'
import type { Corner, Room, Wall } from '../model/schema'
import { FLOOR_SHAPE_ROTATION_X, mmToM, planDirectionToWorldY, planToFloorShape, planToWorld } from '../utils/coords'
import { wallOutline } from './wallOutline'

const WALL_COLOR = '#f3f1ec'
const GLASS_COLOR = '#9cc3e6'

/** 벽 로컬 좌표: x = 벽 방향(m), y = 높이(m), z = 두께 방향(가운데 정렬) */
function buildWallGeometry(length: number, height: number, thickness: number, wall: Wall): ExtrudeGeometry {
  const { outer, holes } = wallOutline(length, height, wall.openings)
  const toV2 = (p: Vec) => new Vector2(mmToM(p.x), mmToM(p.y))
  const shape = new Shape(outer.map(toV2))
  for (const h of holes) shape.holes.push(new Path(h.map(toV2)))
  const depth = mmToM(thickness)
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

interface WallMeshProps {
  wall: Wall
  a: Corner
  b: Corner
  height: number
  transparent: boolean
}

/**
 * 벽 하나. props(wall·corner 객체 참조, 높이)가 그대로면 memo로 건너뛰어
 * 바뀐 벽만 지오메트리를 다시 만든다(문서 업데이트가 불변이므로 참조 비교로 충분).
 * TODO(miter): 접합부는 겹침 허용. 마이터 처리 미구현.
 */
export const WallMesh = memo(function WallMesh({ wall, a, b, height, transparent }: WallMeshProps) {
  const length = distance(a, b)
  const geometry = useMemo(() => buildWallGeometry(length, height, wall.thickness, wall), [length, height, wall])
  useEffect(() => () => geometry.dispose(), [geometry])

  const windows = wall.openings.filter((o) => o.type === 'window')
  return (
    <group position={planToWorld(a.x, a.y)} rotation-y={planDirectionToWorldY(b.x - a.x, b.y - a.y)}>
      <mesh geometry={geometry} castShadow={!transparent} receiveShadow>
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
        <mesh key={o.id} position={[mmToM(o.offset), mmToM(o.sill + o.height / 2), 0]}>
          <boxGeometry args={[mmToM(o.width), mmToM(o.height), mmToM(10)]} />
          <meshStandardMaterial color={GLASS_COLOR} transparent opacity={0.3} roughness={0.1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
})

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
