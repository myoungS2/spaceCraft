import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // 처음 import될 때 Vite가 의존성을 다시 최적화하면 React 사본이 둘로 갈려
    // "Invalid hook call"이 날 수 있다. 시작할 때 한꺼번에 미리 번들링한다.
    include: ['react-konva', 'konva', 'three', '@react-three/fiber', '@react-three/drei'],
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
