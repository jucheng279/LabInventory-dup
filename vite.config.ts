import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import JavaScriptObfuscator from 'javascript-obfuscator';
import type { Plugin } from 'vite';

const { obfuscate } = JavaScriptObfuscator;

function appObfuscatorPlugin(): Plugin {
  const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal' as const,
    renameGlobals: false,
    renameProperties: false,
    selfDefending: true,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: [] as string[],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function' as const,
    stringArrayThreshold: 0.75,
    numbersToExpressions: false,
    transformObjectKeys: false,
    target: 'browser' as const,
    unicodeEscapeSequence: false,
  };

  return {
    name: 'app-obfuscator',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (chunk.fileName.includes('vendor')) {
        return null;
      }
      if (!chunk.fileName.endsWith('.js')) {
        return null;
      }
      const result = obfuscate(code, {
        ...obfuscationOptions,
        inputFileName: chunk.fileName,
        sourceMap: false,
      });
      return {
        code: result.getObfuscatedCode(),
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    appObfuscatorPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('lottie')) {
              return 'vendor-lottie';
            }
            if (id.includes('html5-qrcode') || id.includes('qrcode.react')) {
              return 'vendor-qr';
            }
            if (id.includes('shaders')) {
              return 'vendor-shaders';
            }
            return 'vendor';
          }
          if (id.includes('/src/tutorial/')) {
            return 'app-tutorial';
          }
          if (id.includes('/src/services/')) {
            return 'app-services';
          }
          if (id.includes('/src/components/auth/')) {
            return 'app-auth';
          }
          if (id.includes('/src/components/icons/')) {
            return 'app-icons';
          }
        },
      },
    },
  },
});
