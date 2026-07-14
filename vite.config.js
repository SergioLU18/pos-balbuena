import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Los tests corren en modo mock: ejercitan los stores locales sin tocar Supabase.
    env: { VITE_MOCK: 'true' },
  },
})
