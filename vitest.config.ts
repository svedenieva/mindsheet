import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Scoped to the multiselect grid tests. The older MindSheet.test.tsx needs jsdom
// layout mocks (it renders duplicate nodes without CSS, so getByText finds
// several) — a separate setup task; not run here so `npm test` stays meaningful.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['multiselect.test.tsx', 'select-picker.test.tsx'],
  },
});
