import { CanvasArea } from './editor2d/CanvasArea'
import { useShortcuts } from './hooks/useShortcuts'
import { LeftPanel } from './panels/LeftPanel'
import { PropertiesPanel } from './panels/PropertiesPanel'
import { TopBar } from './panels/TopBar'
import { useUiStore } from './store/uiStore'

export function App() {
  useShortcuts()
  const banner = useUiStore((s) => s.banner)
  const setBanner = useUiStore((s) => s.setBanner)

  return (
    <div className="app">
      <TopBar />
      {banner && (
        <div className="banner" role="alert">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)}>닫기</button>
        </div>
      )}
      <div className="workspace">
        <LeftPanel />
        <main className="canvas">
          <CanvasArea />
        </main>
        <PropertiesPanel />
      </div>
    </div>
  )
}
