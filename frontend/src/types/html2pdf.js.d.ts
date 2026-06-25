// Ambient declaration for html2pdf.js, which ships without TypeScript types. The library exposes a
// chainable default export: html2pdf().set(opts).from(element).save(). Typed loosely as the surface
// we use is small and the upstream types are unavailable.
declare module 'html2pdf.js' {
  const html2pdf: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export default html2pdf;
}
