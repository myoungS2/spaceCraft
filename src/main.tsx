import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initPersistence } from './store/persistence'
import './styles.css'

// 저장된 문서를 먼저 복원한 뒤 렌더해서, 빈 문서가 잠깐 보였다 바뀌는 것을 막는다.
void initPersistence().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
