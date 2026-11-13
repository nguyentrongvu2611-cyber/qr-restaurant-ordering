import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Đảm bảo Vite chỉ dùng duy nhất 1 bản React
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Ép Vite nạp trước các thư viện này để tránh xung đột
    include: ['react', 'react-dom', 'react-router-dom', 'socket.io-client'],
  },
})