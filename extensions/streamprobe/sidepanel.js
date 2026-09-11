import { parseFrame, computeMetrics } from "./core/parsers.js";

const manifest = chrome.runtime.getManifest();
document.querySelector(".sp-brand strong").textContent = `StreamProbe v${manifest.version}`;

const connEl = document.getElementById("sp-connections");
const layoutEl = document.querySelector(".sp-layout");
const framesEl = document.getElementById("sp-frames");
const metricsEl = document.getElementById("sp-metrics");
const rawEl = document.getElementById("sp-raw");
const parsedEl = document.getElementById("sp-parsed");
const tabUrlEl = document.getElementById("sp-tab-url");

let state = { connections: [], frames: [] };
let selectedConnId = null;
let selectedFrameId = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTime(t) {
  return new Date(t).toLocaleTimeString("zh-CN", { hour12: false });
}

function renderMetrics() {
  const metrics = computeMetrics(state);
  const chips = [];
  for (const c of state.connections) {
    const m = metrics[c.id];
    if (!m) continue;
    const ttfb = m.ttfbMs != null ? `TTFB ${m.ttfbMs}ms` : "TTFB —";
    chips.push(
      `<span class="sp-metric">${escapeHtml(c.kind)} · ${m.frameCount} 帧 · ${ttfb}</span>`,
    );
  }
  metricsEl.innerHTML =
    chips.join("") || '<span class="sp-metric">暂无流式连接 — 打开使用 SSE 或 fetch stream 的页面</span>';
}

function renderConnections() {
  if (!state.connections.length) {
    connEl.innerHTML = '<li class="sp-empty">无连接</li>';
    return;
  }
  connEl.innerHTML = state.connections
    .map((c) => {
      const host = (() => {
        try {
          return new URL(c.url).hostname;
        } catch {
          return c.url.slice(0, 24);
        }
      })();
      return `<li><button type="button" data-conn="${c.id}" class="${selectedConnId === c.id ? "active" : ""}">
        <strong>${escapeHtml(host)}</strong>
        <span class="kind">${escapeHtml(c.kind)} · ${escapeHtml(c.status)}</span>
      </button></li>`;
    })
    .join("");

  connEl.querySelectorAll("[data-conn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedConnId = btn.dataset.conn;
      selectedFrameId = null;
      renderConnections();
      renderFrames();
      renderDetail(null);
    });
  });
}

function renderFrames() {
  const list = state.frames.filter((f) => !selectedConnId || f.connectionId === selectedConnId);
  if (!list.length) {
    framesEl.innerHTML = '<li class="sp-empty">无帧</li>';
    return;
  }
  framesEl.innerHTML = list
    .map((f) => {
      const parsed = f.raw ? parseFrame(f.raw) : null;
      const label =
        f.phase === "open"
          ? "OPEN"
          : f.phase === "close"
            ? "CLOSE"
            : f.phase === "error"
              ? "ERROR"
              : parsed?.summary?.slice(0, 40) || "MESSAGE";
      return `<li><button type="button" data-frame="${f.id}" class="phase-${f.phase} ${selectedFrameId === f.id ? "active" : ""}">
        <div class="meta">${escapeHtml(f.phase.toUpperCase())} · ${formatTime(f.t)}</div>
        ${escapeHtml(label)}
      </button></li>`;
    })
    .join("");

  framesEl.querySelectorAll("[data-frame]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFrameId = btn.dataset.frame;
      const frame = state.frames.find((x) => x.id === selectedFrameId);
      renderFrames();
      renderDetail(frame);
    });
  });
}

function renderDetail(frame) {
  if (!frame) {
    rawEl.textContent = "选择左侧一帧";
    parsedEl.textContent = "—";
    return;
  }
  if (frame.phase === "open") {
    rawEl.textContent = `OPEN ${frame.url || ""}`;
    parsedEl.textContent = JSON.stringify({ kind: frame.kind, url: frame.url, t: frame.t }, null, 2);
    return;
  }
  rawEl.textContent = frame.raw || `(${frame.phase})`;
  const parsed = frame.raw ? parseFrame(frame.raw) : { summary: frame.phase, detail: null };
  parsedEl.textContent = JSON.stringify(
    { protocol: parsed.protocol, summary: parsed.summary, detail: parsed.detail },
    null,
    2,
  );
}

function updateEmptyGuide() {
  const guide = document.getElementById("sp-empty-guide");
  const reason = document.getElementById("sp-empty-reason");
  if (!guide) return;
  const empty = !state.connections.length && !state.frames.length;
  guide.hidden = !empty;
  if (layoutEl) layoutEl.hidden = empty;
  const url = tabUrlEl.textContent || "";
  if (empty && /google\.|baidu\.|bing\./i.test(url)) {
    reason.innerHTML =
      "你在<strong>搜索引擎</strong>页面 — 这里没有 AI 流式接口。请打开测试页或你的 AI 项目页。";
  } else if (empty) {
    reason.innerHTML =
      "StreamProbe 只监测 <code>EventSource</code> 和 <code>fetch</code> 流式响应。请<strong>刷新页面</strong>后触发一次对话或 SSE 请求。";
  }
}

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: "sp-get" });
  if (!res?.ok) return;
  tabUrlEl.textContent = res.tabUrl || "—";
  tabUrlEl.title = res.tabUrl || "";
  state = res.session || { connections: [], frames: [] };
  if (selectedConnId && !state.connections.some((c) => c.id === selectedConnId)) {
    selectedConnId = null;
  }
  if (selectedFrameId && !state.frames.some((f) => f.id === selectedFrameId)) {
    selectedFrameId = null;
    renderDetail(null);
  } else if (selectedFrameId) {
    renderDetail(state.frames.find((f) => f.id === selectedFrameId));
  }
  renderMetrics();
  renderConnections();
  renderFrames();
  updateEmptyGuide();
}

document.getElementById("sp-open-demo")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "sp-open-demo" });
});

document.getElementById("sp-clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "sp-clear" });
  selectedConnId = null;
  selectedFrameId = null;
  refresh();
});

document.getElementById("sp-export").addEventListener("click", async () => {
  const res = await chrome.runtime.sendMessage({ type: "sp-export" });
  if (!res?.ok || !res.export) return;
  const blob = new Blob([JSON.stringify(res.export, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `streamprobe-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

refresh();
setInterval(refresh, 800);
