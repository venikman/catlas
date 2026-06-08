// Optional browser benchmark spec placeholder.
//
// The quick quality gate performs an inline Playwright smoke check from
// renderValidator. When dedicated browser benchmark specs are wired into CI,
// this spec should verify:
// - atlas-root and atlas-canvas render
// - no console errors or failed requests
// - initial load does not request /api/atlas/points
// - active LOD markers match low/medium/high zoom interactions

export {};
