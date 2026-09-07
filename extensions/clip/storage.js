const STORAGE_KEY = "clipHubSnippets";

/** @typedef {{ id: string; title: string; content: string; pageUrl?: string; pageTitle?: string; textFragment?: string; scrollY?: number | null; createdAt?: string }} Snippet */

export async function getLocalSnippets() {
  const { [STORAGE_KEY]: items } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(items) ? items : [];
}

/** @param {Snippet[]} items */
export async function setLocalSnippets(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

/** @param {Snippet} snippet */
export async function addLocalSnippet(snippet) {
  const items = await getLocalSnippets();
  items.unshift(snippet);
  await setLocalSnippets(items);
  return snippet;
}

export async function canSyncDesktop() {
  const token = (await chrome.storage.local.get("clipHubToken")).clipHubToken;
  if (!token) return false;
  try {
    const r = await fetch("http://127.0.0.1:38472/health", {
      headers: { "X-Clip-Token": token },
    });
    return r.ok;
  } catch {
    return false;
  }
}
