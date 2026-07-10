import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['lec-logo.jpeg'],
      manifest: {
        name: 'LEC - Alpha',
        short_name: 'LEC Alpha',
        description: 'Love Economy Church — Attendance & Member Management',
        theme_color: '#0066FF',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: '/lec-logo.jpeg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any'
          },
          {
            src: '/lec-logo.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          },
          {
            src: '/lec-logo.jpeg',
            sizes: '1024x1024',
            type: 'image/jpeg',
            purpose: 'any'
          }
        ],
        categories: ['productivity', 'utilities'],
        shortcuts: [
          {
            name: 'Mark Attendance',
            url: '/attendance',
            description: 'Open attendance marking',
            icons: [{ src: '/lec-logo.jpeg', sizes: '96x96', type: 'image/jpeg' }]
          },
          {
            name: 'People Directory',
            url: '/directory',
            description: 'Browse member directory',
            icons: [{ src: '/lec-logo.jpeg', sizes: '96x96', type: 'image/jpeg' }]
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // Cache all assets, fonts, and images
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Runtime caching strategy for Supabase API calls
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }, // 1 hour
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: {
        // Enable service worker in dev for testing
        enabled: false
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
         manualChunks: {
           'vendor-react': ['react', 'react-dom', 'react-router-dom'],
           'vendor-ui': ['lucide-react', 'recharts'],
           'vendor-supabase': ['@supabase/supabase-js']
         }
      }
    }
  }
})
