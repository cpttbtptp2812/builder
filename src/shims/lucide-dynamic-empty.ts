/** OpenUI imports every Lucide icon via this map. Vite walks each `import()` and OOMs on CI. */
const dynamicIconImports: Record<string, () => Promise<{ default: never }>> = {};
export default dynamicIconImports;
