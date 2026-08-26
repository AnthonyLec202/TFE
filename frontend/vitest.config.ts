import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts on purpose: the app config pulls in the React and PWA plugins,
// none of which a unit-test run needs. Vitest picks this file up in preference to vite.config.ts.
export default defineConfig({
  test: {
    // The suites here cover pure helpers — no DOM, no component rendering — so the Node environment
    // is sufficient and avoids pulling jsdom in as a dependency. Anything testing a component or a
    // DOM-touching helper (htmlToPlainText uses DOMParser) will need `environment: 'jsdom'` and the
    // matching package.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
