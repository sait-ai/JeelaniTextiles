import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        admin: './pages/admin.html',
        login: './pages/admin-login.html',
        contact: './pages/contact.html',
        faq: './pages/faq.html',
        products: './pages/products.html'
      }
    }
  },
  server: {
    port: 3000
  },
  css: {
    postcss: {
      plugins: [
        require('postcss-preset-env')({
          stage: 0,
          features: {
            'custom-properties': true
          }
        })
      ]
    }
  }
});