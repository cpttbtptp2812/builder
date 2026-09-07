const LOG_KEY = "mirrorLogs";
const MOCK_KEY = "mirrorMocks";
const MAX = 80;

/** @type {Map<string, object>} */
const pending = new Map();

function shell(entry) {
  return {
    id: entry.id,
    kind: entry.kind || "fetch",
    method: entry.method,
    url: entry.url,
    body: entry.body ?? null,
    status: entry.status ?? null,
    ok: entry.ok ?? null,
    ms: entry.ms ?? null,
    bodyPreview: entry.bodyPreview ?? "",
    error: entry.error ?? null,
    t: entry.t || Date.now(),
  };
}

async function appendLog(row) {
  const { [LOG_KEY]: logs } = await chrome.storage.session.get(LOG_KEY);
  const list = Array.isArray(logs) ? logs : [];
  list.unshift(row);
  await chrome.storage.session.set({ [LOG_KEY]: list.slice(0, MAX) });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "mirror-log") {
    const e = msg.entry;
    if (e.phase === "start") {
      pending.set(e.id, shell(e));
    } else if (e.phase === "end") {
      const base = pending.get(e.id) || { id: e.id };
      pending.delete(e.id);
      const row = { ...base, ...shell({ ...base, ...e }) };
      void appendLog(row);
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "mirror-list") {
    chrome.storage.session.get(LOG_KEY).then(({ [LOG_KEY]: logs }) => {
      sendResponse({ logs: logs || [] });
    });
    return true;
  }

  if (msg.type === "mirror-clear") {
    chrome.storage.session.set({ [LOG_KEY]: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "mirror-set-mock") {
    const { pattern, body, status = 200, enabled = true } = msg;
    chrome.storage.local.get(MOCK_KEY).then(({ [MOCK_KEY]: mocks }) => {
      const next = { ...(mocks || {}), [pattern]: { body, status, enabled } };
      chrome.storage.local.set({ [MOCK_KEY]: next }).then(() => sendResponse({ ok: true }));
    });
    return true;
  }

  if (msg.type === "mirror-del-mock") {
    chrome.storage.local.get(MOCK_KEY).then(({ [MOCK_KEY]: mocks }) => {
      const next = { ...(mocks || {}) };
      delete next[msg.pattern];
      chrome.storage.local.set({ [MOCK_KEY]: next }).then(() => sendResponse({ ok: true }));
    });
    return true;
  }

  if (msg.type === "mirror-get-mocks") {
    chrome.storage.local.get(MOCK_KEY).then(({ [MOCK_KEY]: mocks }) => {
      sendResponse({ mocks: mocks || {} });
    });
    return true;
  }
});
