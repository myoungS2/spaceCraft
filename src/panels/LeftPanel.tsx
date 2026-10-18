import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { catalogCategories, CATALOG_DRAG_TYPE, fullCatalog } from '../data/catalog'
import { createCustomFurniture, isCustomFurnitureInUse, removeCustomFurniture } from '../model/customCatalog'
import type { CustomFurniture } from '../model/schema'
import { placeCatalogItem } from '../store/actions'
import { useDocStore } from '../store/docStore'
import { useUiStore, type DrawTool, type EditorMode } from '../store/uiStore'

const modes: { id: EditorMode; label: string }[] = [
  { id: 'draw', label: '도면 그리기' },
  { id: 'furniture', label: '가구' },
]

export function LeftPanel() {
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)

  return (
    <aside className="panel left">
      <div className="tabs" role="tablist">
        {modes.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'draw' ? <DrawHelp /> : <Catalog />}
    </aside>
  )
}

const tools: { id: DrawTool; label: string; key: string }[] = [
  { id: 'select', label: '선택', key: 'V' },
  { id: 'wall', label: '벽 그리기', key: 'W' },
  { id: 'door', label: '문', key: 'D' },
  { id: 'window', label: '창', key: 'N' },
]

function DrawHelp() {
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  return (
    <div className="panel-body help">
      <div className="tool-buttons">
        {tools.map((t) => (
          <button key={t.id} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
            {t.label}
            <kbd>{t.key}</kbd>
          </button>
        ))}
      </div>
      {tool === 'wall' ? (
        <ul>
          <li>클릭: 벽 이어 그리기</li>
          <li>ESC·우클릭: 그리기 종료</li>
          <li>시작점 클릭: 닫고 종료</li>
          <li>Shift: 수평/수직 고정</li>
        </ul>
      ) : tool === 'door' || tool === 'window' ? (
        <ul>
          <li>벽 위를 클릭해 {tool === 'door' ? '문' : '창'} 배치</li>
          <li>벽 끝이나 다른 개구부와 겹치지 않게 자동으로 밀림</li>
          <li>배치 후 선택 도구로 벽을 따라 드래그</li>
        </ul>
      ) : (
        <ul>
          <li>벽 드래그: 평행 이동</li>
          <li>꼭짓점 드래그: 연결된 벽과 함께 이동</li>
          <li>꼭짓점을 다른 꼭짓점에 놓으면 합쳐짐</li>
          <li>문·창 드래그: 벽을 따라 이동</li>
          <li>Delete: 선택 삭제</li>
        </ul>
      )}
      <ul>
        <li>휠: 줌 · Space+드래그·휠 클릭 드래그: 이동</li>
      </ul>
    </div>
  )
}

function Catalog() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const custom = useDocStore((s) => s.doc.customCatalog)
  const doc = useDocStore((s) => s.doc)
  const updateCustomCatalog = useDocStore((s) => s.updateCustomCatalog)

  const entries = useMemo(() => fullCatalog(custom), [custom])
  const categories = useMemo(() => catalogCategories(entries), [entries])
  const customIds = useMemo(() => new Set(custom.map((c) => c.id)), [custom])
  const items = useMemo(() => {
    const q = query.trim()
    return entries.filter((e) => (!category || e.category === category) && (!q || e.name.includes(q)))
  }, [entries, query, category])

  return (
    <div className="panel-body">
      <input
        className="search"
        type="search"
        placeholder="가구 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="muted">끌어다 놓거나 클릭해서 배치 · R 회전 · Ctrl/Cmd+D 복제</p>
      <div className="chips">
        <button aria-pressed={category === null} onClick={() => setCategory(null)}>
          전체
        </button>
        {categories.map((c) => (
          <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      {adding ? (
        <AddFurnitureForm
          categories={categories}
          defaultCategory={category ?? ''}
          onDone={(entry) => {
            setAdding(false)
            if (entry) setCategory(entry.category)
          }}
        />
      ) : (
        <button className="add-furniture" onClick={() => setAdding(true)}>
          ＋ 가구 종류 추가
        </button>
      )}
      <ul className="catalog">
        {items.map((e) => {
          const mine = customIds.has(e.id)
          const inUse = mine && isCustomFurnitureInUse(doc, e.id)
          return (
            <li key={e.id} className="catalog-row">
              <button
                className="catalog-item"
                draggable
                title="캔버스로 끌어다 놓거나 클릭해서 화면 가운데에 배치"
                onDragStart={(ev) => {
                  ev.dataTransfer.setData(CATALOG_DRAG_TYPE, e.id)
                  ev.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => placeCatalogItem(e.id)}
              >
                <span className="name">
                  {e.name}
                  {mine && <span className="mine-tag">내 가구</span>}
                </span>
                <span className="dims">
                  {e.width}×{e.depth}×{e.height}
                </span>
              </button>
              {mine && (
                <button
                  className="catalog-remove"
                  disabled={inUse}
                  title={inUse ? '도면에 놓인 가구가 있어 지울 수 없습니다' : '이 가구 종류 삭제'}
                  aria-label={`${e.name} 종류 삭제`}
                  onClick={() => updateCustomCatalog((list, d) => removeCustomFurniture(list, d, e.id))}
                >
                  ×
                </button>
              )}
            </li>
          )
        })}
        {items.length === 0 && <li className="empty">검색 결과가 없습니다.</li>}
      </ul>
    </div>
  )
}

/** 사용자 가구 종류 추가 폼. 추가 버튼을 눌렀을 때만 문서에 반영한다(히스토리 1건). */
function AddFurnitureForm({
  categories,
  defaultCategory,
  onDone,
}: {
  categories: string[]
  defaultCategory: string
  onDone: (entry?: CustomFurniture) => void
}) {
  const [form, setForm] = useState({ name: '', category: defaultCategory, width: '1000', depth: '600', height: '800' })
  const [error, setError] = useState<string | null>(null)
  const updateCustomCatalog = useDocStore((s) => s.updateCustomCatalog)
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const r = createCustomFurniture({
      name: form.name,
      category: form.category,
      width: Number(form.width),
      depth: Number(form.depth),
      height: Number(form.height),
    })
    if (!r.ok) {
      setError(r.error)
      return
    }
    updateCustomCatalog((list) => [...list, r.entry])
    onDone(r.entry)
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <label className="field">
        이름
        <input autoFocus placeholder="예: 2인용 소파" {...field('name')} />
      </label>
      <label className="field">
        카테고리
        <input list="furniture-categories" placeholder="고르거나 새로 입력" {...field('category')} />
        <datalist id="furniture-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <div className="field-row three">
        {(['width', 'depth', 'height'] as const).map((k) => (
          <label key={k} className="field">
            {k === 'width' ? '폭' : k === 'depth' ? '깊이' : '높이'} (mm)
            <input type="number" min={1} step={1} inputMode="numeric" {...field(k)} />
          </label>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={() => onDone()}>
          취소
        </button>
        <button type="submit" className="primary">
          추가
        </button>
      </div>
    </form>
  )
}
