// Self-hosted web fonts, replacing the former Google Fonts CDN link. Vite fingerprints and bundles
// these woff2 files, so the Workbox precache ships them with the app shell — the custom typefaces
// (Public Sans / Source Serif 4) render identically offline, and no third-party request is emitted.
//
// Scope kept deliberately narrow: latin + latin-ext subsets (full French coverage) and only the four
// weights the UI actually uses, plus a single italic. The @fontsource family names ('Public Sans',
// 'Source Serif 4') match the @theme tokens verbatim, so no style references change.

// Public Sans — body/UI sans-serif.
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-500.css';
import '@fontsource/public-sans/latin-600.css';
import '@fontsource/public-sans/latin-700.css';
import '@fontsource/public-sans/latin-ext-400.css';
import '@fontsource/public-sans/latin-ext-500.css';
import '@fontsource/public-sans/latin-ext-600.css';
import '@fontsource/public-sans/latin-ext-700.css';
import '@fontsource/public-sans/latin-400-italic.css';
import '@fontsource/public-sans/latin-ext-400-italic.css';

// Source Serif 4 — display serif (headings, brand mark).
import '@fontsource/source-serif-4/latin-400.css';
import '@fontsource/source-serif-4/latin-500.css';
import '@fontsource/source-serif-4/latin-600.css';
import '@fontsource/source-serif-4/latin-700.css';
import '@fontsource/source-serif-4/latin-ext-400.css';
import '@fontsource/source-serif-4/latin-ext-500.css';
import '@fontsource/source-serif-4/latin-ext-600.css';
import '@fontsource/source-serif-4/latin-ext-700.css';
