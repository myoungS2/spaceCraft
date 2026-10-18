import { get, set } from 'idb-keyval'
import { parseDoc } from '../model/migrate'
import type { Doc } from '../model/schema'
import { resetHistory, useDocStore } from './docStore'
import { useUiStore } from './uiStore'

export const STORAGE_KEY = 'roomie:doc'
export const SAVE_DEBOUNCE_MS = 500

export interface DocStorage {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
}

const idbStorage: DocStorage = { get, set }

/**
 * 저장된 문서를 복원하고, 이후 문서가 바뀔 때마다 디바운스해서 저장한다.
 * 반환값은 구독 해제 함수.
 */
export async function initPersistence(storage: DocStorage = idbStorage): Promise<() => void> {
  const ui = useUiStore.getState()

  try {
    const raw = await storage.get(STORAGE_KEY)
    if (raw !== undefined) {
      const result = parseDoc(raw)
      if (result.ok) {
        useDocStore.getState().replaceDoc(result.doc)
      } else {
        // 깨진 문서를 자동저장으로 덮어쓰기 전에 따로 보관한다.
        await storage.set(`${STORAGE_KEY}:corrupt:${Date.now()}`, raw)
        ui.setBanner(`저장된 도면을 불러오지 못해 새 도면으로 시작합니다. (${result.error})`)
      }
    }
  } catch (e) {
    ui.setBanner(`저장소 접근 실패: ${String(e)}`)
  }
  resetHistory()

  let timer: ReturnType<typeof setTimeout> | undefined
  const save = async (doc: Doc) => {
    try {
      await storage.set(STORAGE_KEY, doc)
      useUiStore.getState().setSaveStatus('saved')
    } catch {
      useUiStore.getState().setSaveStatus('error')
    }
  }

  const unsubscribe = useDocStore.subscribe((state, prev) => {
    if (state.doc === prev.doc) return
    useUiStore.getState().setSaveStatus('saving')
    clearTimeout(timer)
    timer = setTimeout(() => void save(state.doc), SAVE_DEBOUNCE_MS)
  })

  return () => {
    clearTimeout(timer)
    unsubscribe()
  }
}
