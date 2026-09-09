importScripts("clean.js", "analyze.js", "pack.js");

const shots = Object.create(null);

const emptyState = () => ({
  recording: false,
  tabId: null,
  startUrl: "",
  name: "",
  description: "",
  issue: "",
  logs: [],
  userAgent: "",
  viewport: null,
  rawSteps: [],
  steps: [],
  startedAt: 0,
});

async function loadState() {
  const { skilltap } = await chrome.storage.session.get("skilltap");
  return skilltap && typeof skilltap === "object" ? { ...emptyState(), ...skilltap } : emptyState();
}

async function saveState(next) {
  await chrome.storage.session.set({ skilltap: next });
  return next;
}

function restricted(url) {
  return !url || /^(chrome|edge|about|devtools|chrome-extension):/i.test(url);
}

async function setBadge(on) {
  await chrome.action.setBadgeText({ text: on ? "REC" : "" });
  if (on) await chrome.action.setBadgeBackgroundColor({ color: "#be123c" });
}

async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["probe.js"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["selector.js", "content.js"],
    });
    return true;
  } catch {
    return false;
  }
}

async function ping(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "skilltap-ping" });
  } catch {
    return null;
  }
}

async function ensureInjected(tabId) {
  const live = await ping(tabId);
  if (live?.ok) return true;
  return inject(tabId);
}

async function setRecordingOnTab(tabId, recording) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "skilltap-set", recording });
    return true;
  } catch {
    return false;
  }
}

function clearShots() {
  for (const key of Object.keys(shots)) delete shots[key];
}

async function blobToDataUrl(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;
}

async function shrinkJpeg(dataUrl) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 960 / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.52 });
    return blobToDataUrl(out);
  } catch {
    return dataUrl;
  }
}

async function captureStep(tab, ts, delay) {
  if (!tab?.windowId || ts == null) return;
  await new Promise((resolve) => setTimeout(resolve, delay));
  try {
    const raw = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 48 });
    shots[String(ts)] = await shrinkJpeg(raw);
  } catch {
    /* 当前窗口未前台时截不到，手册仍有文字步骤 */
  }
}

function packFrom(state) {
  return SkillTapPack.buildPack({
    name: state.name,
    description: state.description,
    issue: state.issue,
    steps: Array.isArray(state.steps) ? state.steps : [],
    logs: Array.isArray(state.logs) ? state.logs : [],
    shots,
    startUrl: state.startUrl,
    userAgent: state.userAgent,
    viewport: state.viewport,
    recordedAt: state.startedAt ? new Date(state.startedAt).toISOString() : new Date().toISOString(),
  });
}

async function startRecording(tab) {
  if (!tab?.id || restricted(tab.url)) {
    return { ok: false, error: "当前页不能录制（浏览器内部页 / 扩展商店）" };
  }
  const ok = await ensureInjected(tab.id);
  if (!ok) return { ok: false, error: "无法注入此页面，请刷新后再试" };

  const prev = await loadState();
  clearShots();
  const state = {
    ...prev,
    recording: true,
    tabId: tab.id,
    startUrl: tab.url || "",
    name: prev.name || (tab.title || "").slice(0, 40),
    logs: [],
    userAgent: "",
    viewport: null,
    rawSteps: [],
    steps: [],
    startedAt: Date.now(),
  };
  await saveState(state);
  await setRecordingOnTab(tab.id, true);
  await setBadge(true);
  return { ok: true, state };
}

async function stopRecording() {
  const state = await loadState();
  if (state.tabId) {
    await setRecordingOnTab(state.tabId, false);
  }
  const next = { ...state, recording: false };
  await saveState(next);
  await setBadge(false);
  return { ok: true, state: next };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "skilltap-get") {
      sendResponse({ ok: true, state: await loadState() });
      return;
    }
    if (msg?.type === "skilltap-save-meta") {
      const state = await loadState();
      const next = {
        ...state,
        name: msg.name ?? state.name,
        description: msg.description ?? state.description,
        issue: msg.issue ?? state.issue,
      };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }
    if (msg?.type === "skilltap-start") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      sendResponse(await startRecording(tab));
      return;
    }
    if (msg?.type === "skilltap-stop") {
      sendResponse(await stopRecording());
      return;
    }
    if (msg?.type === "skilltap-toggle") {
      const state = await loadState();
      if (state.recording) {
        sendResponse(await stopRecording());
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      sendResponse(await startRecording(tab));
      return;
    }
    if (msg?.type === "skilltap-pause") {
      const state = await loadState();
      const step = {
        action: "pause",
        reason: msg.reason || "登录 / 验证码 / 等人处理",
        ts: Date.now(),
        url: state.startUrl,
      };
      const next = {
        ...state,
        rawSteps: [...state.rawSteps, step],
        steps: [...state.steps, step],
      };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }
    if (msg?.type === "skilltap-remove") {
      const state = await loadState();
      const steps = state.steps.filter((_, i) => i !== msg.index);
      const next = { ...state, steps };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }
    if (msg?.type === "skilltap-replace-steps") {
      const state = await loadState();
      const next = { ...state, steps: Array.isArray(msg.steps) ? msg.steps : state.steps };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }
    if (msg?.type === "skilltap-clear") {
      clearShots();
      const next = emptyState();
      await saveState(next);
      await setBadge(false);
      sendResponse({ ok: true, state: next });
      return;
    }
    if (msg?.type === "skilltap-shots") {
      sendResponse({ ok: true, shots });
      return;
    }
    if (msg?.type === "skilltap-preview") {
      const state = await loadState();
      const pack = packFrom(state);
      const blob = new Blob([pack.html], { type: "text/html;charset=utf-8" });
      if (globalThis.__previewUrl) URL.revokeObjectURL(globalThis.__previewUrl);
      globalThis.__previewUrl = URL.createObjectURL(blob);
      await chrome.tabs.create({ url: globalThis.__previewUrl });
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "skilltap-log") {
      const state = await loadState();
      if (!state.recording) {
        sendResponse({ ok: false });
        return;
      }
      const log = msg.log && typeof msg.log === "object" ? msg.log : {};
      const logs = [...(state.logs || []), log].slice(-40);
      await saveState({ ...state, logs });
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "skilltap-env") {
      const state = await loadState();
      await saveState({
        ...state,
        userAgent: msg.userAgent || state.userAgent,
        viewport: msg.viewport || state.viewport,
        startUrl: state.startUrl || msg.url || "",
      });
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "skilltap-import") {
      const data = msg.data && typeof msg.data === "object" ? msg.data : {};
      const steps = Array.isArray(data.steps) ? data.steps : [];
      const next = {
        ...emptyState(),
        name: data.name || "",
        description: data.description || "",
        issue: data.issue || "",
        steps,
        rawSteps: steps,
        logs: Array.isArray(data.logs) ? data.logs : [],
        startUrl: data.startUrl || steps.find((s) => s.url)?.url || "",
        userAgent: data.userAgent || "",
        viewport: data.viewport || null,
        startedAt: Date.parse(data.recordedAt) || Date.now(),
      };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }
    if (msg?.type === "skilltap-open-start") {
      const state = await loadState();
      const url = state.startUrl || state.steps?.find((s) => s.action === "goto")?.url;
      if (!url) {
        sendResponse({ ok: false, error: "包里没有网址" });
        return;
      }
      await chrome.tabs.create({ url });
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "skilltap-step") {
      const state = await loadState();
      if (!state.recording) {
        sendResponse({ ok: false });
        return;
      }
      if (state.tabId && sender.tab?.id && sender.tab.id !== state.tabId) {
        sendResponse({ ok: false });
        return;
      }
      const rawSteps = [...state.rawSteps, msg.step];
      const next = { ...state, rawSteps, steps: rawSteps };
      await saveState(next);
      sendResponse({ ok: true });
      if (msg.step?.action !== "pause") {
        const delay = msg.step?.action === "goto" ? 480 : 120;
        await captureStep(sender.tab, msg.step.ts, delay);
      }
      return;
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  const state = await loadState();
  if (!state.recording || state.tabId !== tabId) return;
  if (info.status === "complete") {
    await ensureInjected(tabId);
    await setRecordingOnTab(tabId, true);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await loadState();
  if (state.tabId === tabId && state.recording) {
    await stopRecording();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-record") return;
  const state = await loadState();
  if (state.recording) {
    await stopRecording();
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await startRecording(tab);
});
