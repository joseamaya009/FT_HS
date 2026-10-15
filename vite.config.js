import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isEmbeddedMobileBuild = process.env.HIDROSMART_MOBILE_BUNDLE === 'true';

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '');
        return path.resolve(__dirname, 'src/assets', filename);
      }
    },
  };
}

function manualChunks(id) {
  const moduleId = id.replace(/\\/g, '/');

  if (!moduleId.includes('/node_modules/')) return;

  if (moduleId.includes('/recharts/')) return 'charts';
  if (moduleId.includes('/@radix-ui/')) return 'radix-ui';
  if (
    moduleId.includes('/@mui/') ||
    moduleId.includes('/@emotion/') ||
    moduleId.includes('/@floating-ui/')
  ) {
    return 'ui-vendor';
  }
  if (moduleId.includes('/i18next/') || moduleId.includes('/react-i18next/')) return 'i18n';
  if (
    moduleId.includes('/react/') ||
    moduleId.includes('/react-dom/') ||
    moduleId.includes('/react-router') ||
    moduleId.includes('/scheduler/')
  ) {
    return 'react-vendor';
  }
  if (moduleId.includes('/lucide-react/')) return 'icons';
}

export default defineConfig({
  plugins: [figmaAssetResolver(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    open: false,
  },
  build: {
    rollupOptions: {
      output: {
        ...(isEmbeddedMobileBuild
          ? { inlineDynamicImports: true }
          : { manualChunks }),
      },
    },
  },
});
