import { signedArea } from '../geometry/rooms'
import type { Opening } from '../model/schema'
import { MIN_LINTEL, wallOutline } from './wallOutline'

const door = (offset: number, extra: Partial<Opening> = {}): Opening => ({
  id: `d${offset}`, type: 'door', offset, width: 900, height: 2100, sill: 0, ...extra,
})
const win = (offset: number, extra: Partial<Opening> = {}): Opening => ({
  id: `w${offset}`, type: 'window', offset, width: 1200, height: 1200, sill: 900, ...extra,
})

/** 외곽 면적 - 구멍 면적 (mm²) */
const solidArea = (o: ReturnType<typeof wallOutline>) =>
  Math.abs(signedArea(o.outer)) - o.holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0)

describe('wallOutline', () => {
  it('개구부 없으면 길이×높이 사각형', () => {
    const o = wallOutline(4000, 2300, [])
    expect(o.outer).toEqual([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2300 },
      { x: 0, y: 2300 },
    ])
    expect(o.holes).toEqual([])
  })

  it('창은 구멍(hole)이 된다', () => {
    const o = wallOutline(4000, 2300, [win(2000)])
    expect(o.holes).toEqual([[
      { x: 1400, y: 900 },
      { x: 1400, y: 2100 },
      { x: 2600, y: 2100 },
      { x: 2600, y: 900 },
    ]])
    expect(solidArea(o)).toBe(4000 * 2300 - 1200 * 1200)
  })

  it('문은 외곽선을 아래에서 파낸다(구멍 아님)', () => {
    const o = wallOutline(4000, 2300, [door(1000), win(3000)])
    expect(o.holes).toHaveLength(1)
    expect(o.outer).toContainEqual({ x: 550, y: 2100 })
    expect(solidArea(o)).toBe(4000 * 2300 - 900 * 2100 - 1200 * 1200)
  })

  it('벽 양 끝에 붙은 문은 폭 0짜리 가시 없이 처리된다', () => {
    const o = wallOutline(4000, 2300, [door(450), door(3550)])
    expect(o.outer).not.toContainEqual({ x: 0, y: 0 })
    expect(o.outer).not.toContainEqual({ x: 4000, y: 0 })
    expect(o.outer).toHaveLength(8)
    expect(solidArea(o)).toBe(4000 * 2300 - 2 * 900 * 2100)
  })

  it('바닥~천장 개구부는 인방을 남긴다', () => {
    const o = wallOutline(4000, 2100, [door(1000)])
    expect(o.outer).toContainEqual({ x: 550, y: 2100 - MIN_LINTEL })
  })

  it('천장에 닿는 창은 위에서 파낸다', () => {
    const o = wallOutline(4000, 2300, [win(2000, { sill: 1100 })])
    expect(o.holes).toHaveLength(0)
    expect(solidArea(o)).toBe(4000 * 2300 - 1200 * 1200)
  })
})
