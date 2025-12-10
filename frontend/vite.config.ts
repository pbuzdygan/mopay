import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    outDir: 'dist'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      includeAssets: [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "mstile-150x150.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "safari-pinned-tab.svg",
        "mopay_banner_512x512.png"
      ],
      manifest: {
        name: "MOPAY",
        short_name: "MOPAY",
        description: "MOPAY application - Progressive Web App",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "any"
          }
        ]
      },
      workbox: {
        runtimeCaching: [
            // Cache tylko assets, nigdy API
            {
            urlPattern: ({ request }) =>
                request.destination === "document" ||
                request.destination === "script" ||
                request.destination === "style" ||
                request.destination === "image" ||
                request.destination === "font",
            handler: "CacheFirst",
            options: {
                cacheName: "mopay-assets-cache",
                expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                },
            },
            },

            // API: zawsze tylko sieć
            {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: {
                cacheName: "mopay-api-no-cache",
            },
            }
            ]
        },
    })
  ]
})
