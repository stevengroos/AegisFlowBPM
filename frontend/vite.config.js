import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Esto separa a React en un archivo ligero
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Esto separa las animaciones pesadas para no bloquear la carga
          framer: ['framer-motion'],
          // Esto encapsula los íconos
          icons: ['lucide-react']
        }
      }
    }
  }
})