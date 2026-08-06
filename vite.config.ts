import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Демо-обвязка вокруг библиотеки: корень — сам репозиторий, чтобы MindSheet
// импортировался относительным путём, без копий и алиасов.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
});
