import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SINGLE export default (merged both into one)
export default defineConfig(({ mode }) => {
  // Load env variables with VITE_ prefix
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    // All plugins here
    plugins: [react(), tailwindcss()],
    
    // Server config
    server: {
      cors: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    
    // Define environment variables
    define: {
      'process.env.VITE_SHOPIFY_STORE_DOMAIN': JSON.stringify('https://opulmkt.myshopify.com'),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
    },
    
    // Path aliases
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    // Build config
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
    },
  };
});
