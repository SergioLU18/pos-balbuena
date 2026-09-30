import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    // setup.js cambia lib/supabase por un cliente falso: ningún test toca el backend.
    setupFiles: ['./src/test/setup.js'],
  },
})
