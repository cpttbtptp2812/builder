const tokenInput = document.getElementById("token");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");
const listEl = document.getElementById("list");

async function readLocalItems() {
  const { clipHubSnippets } = await chrome.storage.local.get("clipHubSnippets");
  return Array.isArray(clipHubSnippets) ? clipHubSnippets : [];
}

async function loadToken() {
  const { clipHubToken, clipHubPendingTags } = await chrome.storage.local.get([
    "clipHubToken",
    "clipHubPendingTags",
  ]);
  if (clipHubToken) tokenInput.value = clipHubToken;
  const tagsEl = document.getElementById("tags");
  if (tagsEl && Array.isArray(clipHubPendingTags)) {
    tagsEl.value = clipHubPendingTags.join(", ");
  }
}

document.getElementById("save-token").addEventListener("click", async () => {
  const clipHubToken = tokenInput.value.trim();
  await chrome.storage.local.set({ clipHubToken });
  await refresh();
});

async function savePendingTags() {
  const raw = document.getElementById("tags")?.value ?? "";
  const tags = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  await chrome.storage.local.set({ clipHubPendingTags: tags });
}

document.getElementById("tags")?.addEventListener("change", () => void savePendingTags());
document.getElementById("tags")?.addEventListener("blur", () => void savePendingTags());

function hostFrom(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function renderList(items) {
  listEl.innerHTML = "";
  if (!items.length) {
    hintEl.textContent =
      "暂无记录。选中文字 → 右键「保存到 ClipHub（含页面位置）」";
    return;
  }

  hintEl.textContent = "";
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
        hintEl.textContent = jumped.error || "无法跳转";
      }
    });
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

function setStatus(synced) {
  if (synced) {
    statusEl.textContent = "已同步桌面";
    statusEl.className = "status on";
    return;
  }
  statusEl.textContent = "本地模式";
  statusEl.className = "status local";
}

async function refresh() {
  hintEl.textContent = "加载中…";

  let items = await readLocalItems();
  let synced = false;

  try {
    const ping = await chrome.runtime.sendMessage({ type: "ping" });
    synced = Boolean(ping?.synced);
    if (synced) {
      const res = await chrome.runtime.sendMessage({ type: "list" });
      if (res?.ok && Array.isArray(res.items)) {
        items = res.items;
      }
    }
  } catch {
    /* 后台未就绪时仍显示本地列表 */
  }

  setStatus(synced);
  renderList(items);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.clipHubSnippets) return;
  const items = changes.clipHubSnippets.newValue;
  renderList(Array.isArray(items) ? items : []);
});

loadToken().then(refresh);
