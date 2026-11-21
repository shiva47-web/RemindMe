
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      includeAssets: [
        'favicon.ico',
        'push-sw.js'
      ],

      manifest: {
        name: 'RemindMe - Remember Less, Live More',
        short_name: 'RemindMe',
        description: 'Your personal reminder and task management application.',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',

        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

      workbox: {
        importScripts: ['/push-sw.js'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ]
})
