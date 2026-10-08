export function openProductView(view: string, extra?: Record<string, string>) {
  const hash = window.location.hash;
  const path = hash.startsWith("#") ? hash.slice(1).split("?")[0] : "/work/ownagent";
  const params = new URLSearchParams(hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "");
  params.set("tab", "product");
  params.set("view", view);
  if (view !== "editset" && !(view === "versions" && extra?.set)) params.delete("set");
  if (extra) {
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
  }
  window.location.hash = `${path}?${params.toString()}`;
}
