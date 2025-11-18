import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import postcssPresetEnv from 'postcss-preset-env';

export default defineConfig({
  root: './',
  base: '/',
  
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      modernPolyfills: true
    })
  ],
  
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2015',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: './index.html',
        admin: './pages/admin.html',
        login: './pages/admin-login.html',
        contact: './pages/contact.html',
        faq: './pages/faq.html',
        products: './pages/products.html',
        // Add missing pages
        privacy: './pages/privacy.html',
        terms: './pages/terms.html'
      }
    }
  },
  
  server: {
    port: 3000,
    host: true,
    open: true
  },
  
  preview: {
    port: 4173,
    host: true
  },
  
  css: {
    postcss: {
      plugins: [
        postcssPresetEnv({
          stage: 2, // Use stable features only
          features: {
            'nesting-rules': true,
            'custom-media-queries': true,
            'custom-properties': false // Already has 96% browser support
          }
        })
      ]
    }
  },
  
  resolve: {
    alias: {
      '@': '/js',
      '@utils': '/js/utils',
      '@managers': '/js/managers',
      '@services': '/js/services',
      '@components': '/js/components'
    }
  }
});