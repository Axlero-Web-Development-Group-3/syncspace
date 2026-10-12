
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js': path.resolve(
        process.cwd(),
        'node_modules/monaco-editor/esm/vs/editor/editor.api.js'
      ),
    },
    dedupe: ['yjs', 'monaco-editor'],
  },
  optimizeDeps: {
    exclude: ['y-monaco'],
  },
})
