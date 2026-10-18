import { newId } from './ids'
import { SCHEMA_VERSION, type Doc, type Floor } from './schema'

export const DEFAULT_FLOOR_HEIGHT = 2300
export const DEFAULT_WALL_THICKNESS = 200
export const DEFAULT_GRID_SNAP = 50

export function createFloor(name = '1층'): Floor {
  return {
    id: newId('floor'),
    name,
    height: DEFAULT_FLOOR_HEIGHT,
    corners: [],
    walls: [],
    rooms: [],
    items: [],
  }
}

export function createEmptyDoc(): Doc {
  return {
    schemaVersion: SCHEMA_VERSION,
    unit: 'mm',
    floors: [createFloor()],
    settings: { gridSnap: DEFAULT_GRID_SNAP },
  }
}
