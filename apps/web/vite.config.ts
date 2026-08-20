import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages sirve el proyecto bajo /sunname-delcampo/, no en la raíz
  // del dominio; en desarrollo se queda en "/" para no romper localhost.
  base: command === 'serve' ? '/' : '/sunname-delcampo/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
