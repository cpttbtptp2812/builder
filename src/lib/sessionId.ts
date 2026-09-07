const SESSION_KEY = "builder:session-id";

export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function getProbeUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${import.meta.env.BASE_URL}index.html`;
}

export function collectClientPerf(): Record<string, unknown> {
  if (typeof performance === "undefined") return {};
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const resources = performance.getEntriesByType("resource");
  type PerfMem = Performance & { memory?: { usedJSHeapSize: number } };
  const mem = (performance as PerfMem).memory;
  return {
    ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
    loadMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
    resourceCount: resources.length,
    memoryMb: mem ? Math.round((mem.usedJSHeapSize / 1024 / 1024) * 10) / 10 : null,
    source: "client",
  };
}

export function captureDomSnapshot(root?: Element | null, compact = true) {
  const el =
    root ??
    document.querySelector(".agent-product-live") ??
    document.querySelector(".skill-runtime-lab") ??
    document.querySelector(".platform-lab");
  if (!el) return null;

  const nodes: { role: string; name: string; tag: string }[] = [];
  function walk(node: Element, depth: number) {
    if (compact && depth > 4) return;
    const role =
      node.getAttribute("role") ??
      ({ BUTTON: "button", A: "link", INPUT: "textbox", TEXTAREA: "textbox" } as Record<string, string>)[node.tagName] ??
      "generic";
    const name =
      node.getAttribute("aria-label") ??
      (node as HTMLElement).innerText?.slice(0, 48).trim() ??
      node.tagName.toLowerCase();
    if (name || role !== "generic") nodes.push({ role, name, tag: node.tagName.toLowerCase() });
    for (const child of node.children) walk(child, depth + 1);
  }
  walk(el, 0);
  return {
    root: el.tagName.toLowerCase(),
    nodeCount: nodes.length,
    nodes: nodes.slice(0, compact ? 24 : 48),
    capturedAt: new Date().toISOString(),
    source: "client",
  };
}
