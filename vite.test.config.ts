// Temporary: isolated test stack (proxy to :8081). Safe to delete.
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.ts'

export default mergeConfig(base, defineConfig({
  server: { port: 5174, strictPort: true, watch: null, proxy: { '/api': 'http://localhost:8081' } },
}))
