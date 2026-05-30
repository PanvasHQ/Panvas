import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env': {
      IS_PREACT: 'false',
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    }
  },
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: ['**/src/Background Images/**'],
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
});
