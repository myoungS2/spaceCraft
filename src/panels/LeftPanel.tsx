import { useMemo, useState } from 'react'
import { catalog, catalogCategories, CATALOG_DRAG_TYPE } from '../data/catalog'
import { placeCatalogItem } from '../store/actions'
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
      <p className="muted">끌어다 놓거나 클릭해서 배치 · R 회전 · Ctrl/Cmd+D 복제</p>
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
          <li key={e.id}>
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
              <span className="name">{e.name}</span>
              <span className="dims">
                {e.width}×{e.depth}×{e.height}
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="empty">검색 결과가 없습니다.</li>}
      </ul>
    </div>
  )
}
