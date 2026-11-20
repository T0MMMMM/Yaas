import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@core': resolve(__dirname, 'src/core'),
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      // Dependencies stay external (electron-vite's default, spelled out for these three): the
      // extension packages resolve their own preload files from node_modules at runtime.
      externalizeDeps: {
        include: [
          'electron-chrome-extensions',
          'electron-chrome-web-store',
          '@ghostery/adblocker-electron',
        ],
      },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      // A sandboxed preload can only `require('electron')`: the browser-action element is bundled.
      externalizeDeps: { exclude: ['electron-chrome-extensions'] },
      rollupOptions: {
        input: {
          // The app preload (UI window and overlay).
          index: resolve(__dirname, 'src/preload/index.ts'),
          // The `browser.*` mirror registered on space sessions (spike fix 1).
          browserMirror: resolve(__dirname, 'src/preload/browserMirror.ts'),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: { ...alias, '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
    plugins: [react()],
  },
})
