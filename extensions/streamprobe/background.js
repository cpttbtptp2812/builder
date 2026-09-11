const STORE_KEY = "streamProbeSessions";
const MAX_FRAMES = 300;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

function emptySession() {
  return { connections: [], frames: [] };
}

async function getStore() {
  const { [STORE_KEY]: store } = await chrome.storage.session.get(STORE_KEY);
  return store || {};
}

async function getTabSession(tabId) {
  const store = await getStore();
  return store[tabId] || emptySession();
}

async function saveTabSession(tabId, session) {
  const store = await getStore();
  store[tabId] = session;
  await chrome.storage.session.set({ [STORE_KEY]: store });
}

function upsertConnection(session, payload) {
  let conn = session.connections.find((c) => c.id === payload.connectionId);
  if (!conn) {
    conn = {
      id: payload.connectionId,
      kind: payload.kind || "eventsource",
      url: payload.url || "",
      openedAt: payload.t,
      status: "open",
    };
    session.connections.unshift(conn);
  }
  if (payload.phase === "error") conn.status = "error";
  if (payload.phase === "close") {
    conn.status = "closed";
    conn.closedAt = payload.t;
  }
  return conn;
}

function pushFrame(session, payload) {
  if (payload.phase === "open") {
    upsertConnection(session, payload);
    session.frames.unshift({
      id: crypto.randomUUID(),
      connectionId: payload.connectionId,
      phase: "open",
      kind: payload.kind,
      url: payload.url,
      raw: "",
      t: payload.t,
    });
  } else {
    upsertConnection(session, payload);
    session.frames.unshift({
      id: crypto.randomUUID(),
      connectionId: payload.connectionId,
      phase: payload.phase,
      kind: payload.kind,
      url: payload.url,
      raw: payload.raw || "",
      t: payload.t,
    });
  }
  session.frames = session.frames.slice(0, MAX_FRAMES);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "sp-event") {
    const tabId = sender.tab?.id;
    if (!tabId) return false;
    getTabSession(tabId).then((session) => {
      pushFrame(session, msg.payload);
      saveTabSession(tabId, session);
    });
    return false;
  }

  if (msg.type === "sp-get") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const session = tab?.id ? await getTabSession(tab.id) : emptySession();
      sendResponse({
        ok: true,
        tabId: tab?.id,
        tabUrl: tab?.url || "",
        session,
      });
    })();
    return true;
  }

  if (msg.type === "sp-clear") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await saveTabSession(tab.id, emptySession());
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "sp-export") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const session = tab?.id ? await getTabSession(tab.id) : emptySession();
      sendResponse({
        ok: true,
        export: {
          version: 1,
          exportedAt: new Date().toISOString(),
          pageUrl: tab?.url || "",
          connections: session.connections,
          frames: [...session.frames].reverse(),
        },
      });
    })();
    return true;
  }

  if (msg.type === "sp-open-panel") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId != null) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "sp-inject-test") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ ok: false, error: "no-tab" });
        return;
      }
      const session = buildSelfTestSession(tab.url || "");
      await saveTabSession(tab.id, session);
      if (tab.windowId != null) {
        await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
      }
      sendResponse({ ok: true, frameCount: session.frames.length });
    })();
    return true;
  }

  if (msg.type === "sp-open-demo") {
    (async () => {
      const url = chrome.runtime.getURL("demo.html");
      const tab = await chrome.tabs.create({ url });
      if (tab.windowId != null) {
        await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});

/** 往当前 Tab 注入模拟帧 — 任意页面（含 Google）可验证 Panel 是否正常 */
function buildSelfTestSession(pageUrl) {
  const session = emptySession();
  const connectionId = crypto.randomUUID();
  const url = `${pageUrl.split("#")[0]}#streamprobe-self-test`;
  const base = Date.now();
  const lines = [
    { phase: "open", raw: "" },
    { phase: "message", raw: '{"type":"start","turnId":"self-test"}' },
    { phase: "message", raw: '{"type":"text-delta","text":"自检成功"}' },
    { phase: "message", raw: '{"type":"text-delta","text":" — StreamProbe 正常"}' },
    { phase: "message", raw: '{"type":"finish"}' },
    { phase: "close", raw: "" },
  ];
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    pushFrame(session, {
      phase: item.phase,
      kind: "self-test",
      connectionId,
      url,
      raw: item.raw,
      t: base + i * 120,
    });
  }
  return session;
}
