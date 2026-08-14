import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 🔥 FIX: Transformado de Objeto a Función para compatibilidad con Vite 8+
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Empaquetamos las animaciones
            if (id.includes('framer-motion')) {
              return 'framer';
            }
            // Empaquetamos los íconos
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // Empaquetamos el núcleo de React
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
          }
        }
      }
    }
  }
})