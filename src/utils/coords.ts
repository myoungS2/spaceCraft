/**
 * 2D 문서 좌표(mm, y-down) ↔ 3D 월드 좌표(m, y-up) 변환은 이 파일에서만 한다.
 * 규칙: 2D (x, y) → 3D (x / 1000, 높이 / 1000, y / 1000)
 * 2D의 y축(아래쪽)이 3D의 +z(화면 앞쪽)에 대응하므로 위에서 내려다본 3D가 2D 도면과 같은 방향이 된다.
 */

export const MM_PER_M = 1000

export type Vec3 = [number, number, number]

export const mmToM = (mm: number): number => mm / MM_PER_M

export const mToMm = (m: number): number => Math.round(m * MM_PER_M)

/** 2D 평면 위 점(mm)과 바닥으로부터의 높이(mm)를 3D 좌표(m)로 */
export const planToWorld = (x: number, y: number, elevation = 0): Vec3 => [
  mmToM(x),
  mmToM(elevation),
  mmToM(y),
]

/** 3D 좌표(m)를 2D 평면 점(mm)으로. 높이는 버린다. */
export const worldToPlan = (wx: number, wz: number): { x: number; y: number } => ({
  x: mToMm(wx),
  y: mToMm(wz),
})

/**
 * 2D 회전(degree, y-down 화면 기준 시계 방향)을 3D Y축 회전(rad)으로.
 * y-down 평면의 시계 방향 회전은 위에서 본 3D(y-up)에서 -Y축 회전과 같다.
 */
export const planRotationToWorldY = (deg: number): number => (-deg * Math.PI) / 180
