import { useGLTF } from '@react-three/drei'
import { Component, memo, Suspense, useMemo, type ReactNode } from 'react'
import { Box3, Vector3, type Mesh, type Object3D } from 'three'
import { catalogEntry } from '../data/catalog'
import { itemDims, type Dims } from '../geometry/items'
import type { Item } from '../model/schema'
import { mmToM, planRotationToWorldY, planToWorld } from '../utils/coords'

const CATEGORY_COLORS: Record<string, string> = {
  소파: '#8c9bb5',
  침대: '#c9b79c',
  테이블: '#a8825f',
  의자: '#7f8c6d',
  수납: '#b9a48a',
  가전: '#d4d7dc',
}

/** GLB를 못 불러오면 대체 렌더로 넘어가기 위한 경계 */
class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('[Roomie] 가구 모델을 불러오지 못해 박스로 대체합니다.', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** 모델이 없을 때: 치수(W×D×H) 박스. 바닥(y=0)에 놓인다. */
function BoxFallback({ dims, color }: { dims: Dims; color: string }) {
  const [w, h, d] = [mmToM(dims.width), mmToM(dims.height), mmToM(dims.depth)]
  return (
    <mesh position-y={h / 2} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
}

/**
 * GLB 모델을 복제해 바운딩박스를 W×D×H에 맞춰(축별 스케일) 바닥 중앙에 놓는다.
 * 모델의 앞쪽이 +Z(2D에서 깊이 +방향)를 향한다고 가정한다.
 */
function GlbModel({ url, dims }: { url: string; dims: Dims }) {
  const { scene } = useGLTF(url)
  const object = useMemo(() => {
    const clone: Object3D = scene.clone(true)
    clone.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())
    const target = new Vector3(mmToM(dims.width), mmToM(dims.height), mmToM(dims.depth))
    const s = new Vector3(
      size.x > 0 ? target.x / size.x : 1,
      size.y > 0 ? target.y / size.y : 1,
      size.z > 0 ? target.z / size.z : 1,
    )
    clone.scale.copy(s)
    const center = box.getCenter(new Vector3())
    clone.position.set(-center.x * s.x, -box.min.y * s.y, -center.z * s.z)
    return clone
  }, [scene, dims.width, dims.height, dims.depth])
  return <primitive object={object} />
}

/** 가구 하나. 위치·회전은 coords.ts 변환을 거친다. */
export const ItemModel = memo(function ItemModel({ item }: { item: Item }) {
  const entry = catalogEntry(item.catalogId)
  const dims = itemDims(item, entry)
  const fallback = <BoxFallback dims={dims} color={CATEGORY_COLORS[entry.category] ?? '#b0b5bd'} />

  return (
    <group position={planToWorld(item.x, item.y)} rotation-y={planRotationToWorldY(item.rotation)}>
      {entry.modelUrl ? (
        <ModelErrorBoundary key={entry.modelUrl} fallback={fallback}>
          <Suspense fallback={fallback}>
            <GlbModel url={entry.modelUrl} dims={dims} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        fallback
      )}
    </group>
  )
})
