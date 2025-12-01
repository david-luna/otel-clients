import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite';

// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url))

const LIB_TYPE = process.env.LIB_TYPE || 'upstream';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, `lib/bundle-${LIB_TYPE}.js`),
            formats: ['umd'],
            name: 'otel-browser',
            fileName: (format, entryName) => `otel-browser-${entryName}.${format}.js`
        },
        sourcemap: true,
    }
});
