const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
let wireTimer = null;

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((p) => {
      const on = p.id === `panel-${name}`;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    if (name === "wire") startWirePoll();
    else stopWirePoll();
    if (name === "env") loadEnv();
    if (name === "clip") refreshClip();
  });
});

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* —— ClipHub —— */
const clipStatusEl = document.getElementById("clip-status");
const clipHintEl = document.getElementById("clip-hint");
const clipListEl = document.getElementById("clip-list");
const clipTokenInput = document.getElementById("clip-token");

async function readLocalItems() {
  const { clipHubSnippets } = await chrome.storage.local.get("clipHubSnippets");
  return Array.isArray(clipHubSnippets) ? clipHubSnippets : [];
}

async function loadClipToken() {
  const { clipHubToken, clipHubPendingTags } = await chrome.storage.local.get([
    "clipHubToken",
    "clipHubPendingTags",
  ]);
  if (clipHubToken) clipTokenInput.value = clipHubToken;
  const tagsEl = document.getElementById("clip-tags");
  if (tagsEl && Array.isArray(clipHubPendingTags)) {
    tagsEl.value = clipHubPendingTags.join(", ");
  }
}

document.getElementById("clip-save-token").addEventListener("click", async () => {
  await chrome.storage.local.set({ clipHubToken: clipTokenInput.value.trim() });
  await refreshClip();
});

async function savePendingTags() {
  const raw = document.getElementById("clip-tags")?.value ?? "";
  const tags = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await chrome.storage.local.set({ clipHubPendingTags: tags });
}

document.getElementById("clip-tags")?.addEventListener("change", () => void savePendingTags());
document.getElementById("clip-tags")?.addEventListener("blur", () => void savePendingTags());

function hostFrom(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function renderClipList(items) {
  clipListEl.innerHTML = "";
  if (!items.length) {
    clipHintEl.textContent = "暂无记录。选中文字 → 右键「保存到 ClipHub（含页面位置）」";
    return;
  }
  clipHintEl.textContent = "";
  for (const item of items) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    const host = hostFrom(item.pageUrl);
    const sub = host ? `${host} · ${item.content}` : item.content;
    btn.innerHTML = `<strong>${escapeHtml(item.title || host || "网页片段")}</strong><span>${escapeHtml(sub)}</span>`;
    btn.addEventListener("click", async () => {
      const jumped = await chrome.runtime.sendMessage({ type: "jump", item });
      if (jumped.ok) {
        btn.style.borderColor = "#0d9488";
        setTimeout(() => {
          btn.style.borderColor = "";
        }, 800);
      } else {
        clipHintEl.textContent = jumped.error || "无法跳转";
      }
    });
    li.appendChild(btn);
    clipListEl.appendChild(li);
  }
}

function setClipStatus(synced) {
  if (synced) {
    clipStatusEl.textContent = "已同步桌面";
    clipStatusEl.className = "status on";
    return;
  }
  clipStatusEl.textContent = "本地模式";
  clipStatusEl.className = "status local";
}

async function refreshClip() {
  clipHintEl.textContent = "加载中…";
  let items = await readLocalItems();
  let synced = false;
  try {
    const ping = await chrome.runtime.sendMessage({ type: "ping" });
    synced = Boolean(ping?.synced);
    if (synced) {
      const res = await chrome.runtime.sendMessage({ type: "list" });
      if (res?.ok && Array.isArray(res.items)) items = res.items;
    }
  } catch {
    /* 后台未就绪时仍显示本地列表 */
  }
  setClipStatus(synced);
  renderClipList(items);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.clipHubSnippets) return;
  const panel = document.getElementById("panel-clip");
  if (!panel?.classList.contains("active")) return;
  const items = changes.clipHubSnippets.newValue;
  renderClipList(Array.isArray(items) ? items : []);
});

/* —— Env —— */
let envHost = "";

async function loadEnv() {
  const h = await chrome.runtime.sendMessage({ type: "env-get-host" });
  envHost = h?.host || "";
  document.getElementById("env-host").textContent = envHost || "非 http 页面";
  if (!envHost) return;

  const res = await chrome.runtime.sendMessage({ type: "env-load", host: envHost });
  const p = res?.profile;
  if (!p) return;

  document.getElementById("env-enabled").checked = Boolean(p.enabled);
  document.getElementById("env-apiBase").value = p.apiBase || "";
  document.getElementById("env-rewriteHost").checked = Boolean(p.rewriteHost);
  document.getElementById("env-token").value = p.token || "";
  document.getElementById("env-headers").value = p.headers ? JSON.stringify(p.headers, null, 0) : "";
}

function showEnvMsg(text, err = false) {
  const el = document.getElementById("env-msg");
  el.textContent = text;
  el.className = err ? "msg err" : "msg";
}

document.getElementById("env-save").addEventListener("click", async () => {
  if (!envHost) return showEnvMsg("当前页无法配置", true);

  let headers = {};
  const rawHeaders = document.getElementById("env-headers").value.trim();
  if (rawHeaders) {
    try {
      headers = JSON.parse(rawHeaders);
    } catch {
      return showEnvMsg("Header JSON 格式错误", true);
    }
  }

  const profile = {
    enabled: document.getElementById("env-enabled").checked,
    apiBase: document.getElementById("env-apiBase").value.trim(),
    rewriteHost: document.getElementById("env-rewriteHost").checked,
    token: document.getElementById("env-token").value.trim(),
    headers,
  };

  await chrome.runtime.sendMessage({ type: "env-save", host: envHost, profile });
  showEnvMsg("已保存 — 请刷新目标页面");
});

document.getElementById("env-enabled").addEventListener("change", () => {
  document.getElementById("env-save").click();
});

/* —— Wire —— */
function renderWireFrames(frames) {
  const el = document.getElementById("wire-frames");
  if (!frames.length) {
    el.innerHTML = '<li class="empty">暂无 SSE — 打开使用 EventSource 的页面</li>';
    return;
  }
  el.innerHTML = frames
    .map((f) => {
      const time = new Date(f.t).toLocaleTimeString();
      if (f.type === "open") {
        return `<li class="type-open"><div class="meta">OPEN · ${time}</div><div class="url">${escapeHtml(f.url)}</div></li>`;
      }
      if (f.type === "error") {
        return `<li class="type-error"><div class="meta">ERROR · ${time}</div><div class="url">${escapeHtml(f.url)}</div></li>`;
      }
      return `<li class="type-message"><div class="meta">MESSAGE · ${time}</div><div class="data">${escapeHtml(f.data || "")}</div></li>`;
    })
    .join("");
}

async function refreshWire() {
  const res = await chrome.runtime.sendMessage({ type: "wire-list" });
  renderWireFrames(res?.frames || []);
}

function startWirePoll() {
  refreshWire();
  if (wireTimer) return;
  wireTimer = setInterval(refreshWire, 1000);
}

function stopWirePoll() {
  if (!wireTimer) return;
  clearInterval(wireTimer);
  wireTimer = null;
}

document.getElementById("wire-clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "wire-clear" });
  refreshWire();
});

loadClipToken().then(refreshClip);
