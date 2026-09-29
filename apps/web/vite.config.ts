/// <reference types="vitest/config" />
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
const appVersion = randomUUID()

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages sirve el proyecto bajo /sunname-delcampo/, no en la raíz
  // del dominio; en desarrollo se queda en "/" para no romper localhost.
  base: command === 'serve' ? '/' : '/sunname-delcampo/',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'app-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version: appVersion }),
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // jsdom para todos los tests -- las pruebas de funciones puras que
    // ya existen (granel, text, match, voice) no lo necesitan pero no
    // les afecta; sin esto no se puede renderizar un componente de
    // React en una prueba.
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
}))
