import { nanoid } from 'nanoid'

export type IdPrefix = 'doc' | 'floor' | 'c' | 'w' | 'o' | 'r' | 'i' | 'f'

/** 사람이 디버깅할 때 종류를 알아보기 쉽도록 접두어를 붙인다. 예: w_V1StGXR8 */
export const newId = (prefix: IdPrefix): string => `${prefix}_${nanoid(10)}`
