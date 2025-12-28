/* ============================================================================
   LEEWAY HEADER — DO NOT REMOVE
   PROFILE: LEEWAY-ORDER
   TAG: CORE.CONFIG.RUNTIME.VITE
   REGION: 🟢 CORE
   VERSION: 1.2.0
   ============================================================================
   vite.config.ts

   Update goals (AOS Browser Gate aligned):
   - Keep GitHub Pages-friendly base ("./")
   - Keep node polyfills + fs/path shims
   - Add COOP/COEP headers for SharedArrayBuffer (ORT threaded WASM) in dev + preview
   - Treat .wasm/.onnx as assets (no inlining)
   - Keep chunking strategy
   - Support modern ORT packaging:
       * ORT now commonly ships `ort-wasm-simd-threaded.wasm`
       * Your app may still reference legacy names (`ort-wasm.wasm`, etc.)
       * This config does NOT rename files; it ensures correct serving + isolation.
       * Use the compatibility-copy script (or update your gate/runtime) if legacy names are required.

   DISCOVERY_PIPELINE:
     MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
     ROLE=build-config;
     INTENT_SCOPE=build-runtime;
     LOCATION_DEP=none;
     VERTICALS=tooling;
     RENDER_SURFACE=devserver+preview;
     SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

   SPDX-License-Identifier: MIT
   ============================================================================ */

import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, type UserConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';


export default defineConfig(({ mode }: { mode: string }): UserConfig => {
  const isProd = mode === 'production';

  return {
    // ✅ GitHub Pages-friendly relative base (keeps static asset paths local)
    base: './',

    plugins: [
      react(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      }),
    ],

    define: {
      global: 'window',
    },

    /**
     * ✅ COOP/COEP are required for SharedArrayBuffer → ORT wasm threading.
     * Add to BOTH server and preview so `vite preview` behaves like prod test.
     */
    server: {
      port: 3000,
      open: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },

    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },

    resolve: {
      alias: {
        // ✅ Browser shims
        fs: resolve(__dirname, 'src/shims/empty.ts'),
        path: resolve(__dirname, 'src/shims/empty.ts'),
        // Browser shims or package aliases
        // Note: do NOT alias 'onnxruntime-web' to a /public path — Vite will
        // treat that as a module import and fail. Leave ORT to resolve from
        // the package and use `wasmPaths` at runtime to point to `/onnx/`.
        // Map '/onnx' imports (used by @xenova/transformers) to the
        // onnxruntime-web distribution in node_modules so Vite resolves
        // them as modules instead of treating them as /public assets.
        '/onnx': resolve(__dirname, 'node_modules/onnxruntime-web/dist'),
        '/onnx/': resolve(__dirname, 'node_modules/onnxruntime-web/dist') + '/',
        // Support legacy /models/onnx/ paths used by some patched packages
        '/models/onnx': resolve(__dirname, 'node_modules/onnxruntime-web/dist'),
        '/models/onnx/': resolve(__dirname, 'node_modules/onnxruntime-web/dist') + '/',
      },
    },

    /**
     * ✅ Force Vite to treat model/runtime binaries as real assets.
     * This helps ensure they are copied to dist and served as files.
     */
    assetsInclude: [
      '**/*.wasm',
      '**/*.onnx',
      '**/*.ort',
      '**/*.bin',
      '**/*.json',
      '**/*.txt',
    ],

    build: {
      outDir: 'dist',
      target: 'esnext',
      sourcemap: true,
      chunkSizeWarningLimit: 1500,

      // ✅ Never inline binaries into JS
      assetsInlineLimit: 0,

      rollupOptions: {
        // Suppress EVAL warnings coming from prebuilt ORT bundles
        // (these are expected in third-party minified libs and safe to ignore)
        external: (id) => {
          if (!id) return false;
          // Keep package externalization
          if (id === 'onnxruntime-web') return true;
          // Treat public-served ORT/transformers assets as external so Rollup
          // does not attempt to resolve them during build (they are copied
          // to /public and served as static files).
          if (typeof id === 'string' && (id.startsWith('/models/onnx/') || id.startsWith('/models/') || id.startsWith('/transformers/') || id.startsWith('/models/onnx'))) return true;
          return false;
        },
        onwarn(warning: import('rollup').RollupLog, warn: (warning: import('rollup').RollupLog) => void) {
          try {
            // fall through to default warn
          } catch (e) {
            // fall through to default warn
          }
          warn(warning);
        },
        output: {
          manualChunks(id) {
            if (!id) return;
            if (id.includes('node_modules/@xenova/transformers')) return 'transformers';
            if (id.includes('node_modules/onnxruntime-web')) return 'onnxruntime-web';
            if (id.includes('node_modules/react')) return 'react-vendor';
            if (id.includes('node_modules/three')) return 'three-vendor';
            if (id.includes('node_modules')) return 'vendor';
          },
        },
      },
    },

    /**
     * ✅ ORT + Vite: avoid prebundle behaviors that can confuse wasm resolution.
     * NOTE: If you import `onnxruntime-web` directly in app code, excluding it from
     * optimizeDeps is often the safer choice for wasm path stability.
     */
    optimizeDeps: {
      // Exclude ORT from prebundle to avoid Vite static analysis errors
      exclude: ['onnxruntime-web'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
  };
});
