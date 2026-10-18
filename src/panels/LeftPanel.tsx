import { useMemo, useState } from 'react'
import { catalog, catalogCategories } from '../data/catalog'
import { useUiStore, type EditorMode } from '../store/uiStore'

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

function DrawHelp() {
  return (
    <div className="panel-body help">
      <p>캔버스를 클릭해 벽을 이어 그립니다.</p>
      <ul>
        <li>ESC: 그리기 종료</li>
        <li>시작점 클릭: 닫고 종료</li>
        <li>Shift: 직교</li>
        <li>휠: 줌 · Space+드래그: 이동</li>
      </ul>
    </div>
  )
}

function Catalog() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const items = useMemo(() => {
    const q = query.trim()
    return catalog.filter((e) => (!category || e.category === category) && (!q || e.name.includes(q)))
  }, [query, category])

  return (
    <div className="panel-body">
      <input
        className="search"
        type="search"
        placeholder="가구 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips">
        <button aria-pressed={category === null} onClick={() => setCategory(null)}>
          전체
        </button>
        {catalogCategories.map((c) => (
          <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <ul className="catalog">
        {items.map((e) => (
          <li key={e.id} className="catalog-item" data-catalog-id={e.id}>
            <span className="name">{e.name}</span>
            <span className="dims">
              {e.width}×{e.depth}×{e.height}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="empty">검색 결과가 없습니다.</li>}
      </ul>
    </div>
  )
}
