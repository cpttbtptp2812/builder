function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(frames) {
  const el = document.getElementById("frames");
  if (!frames.length) {
    el.innerHTML = '<li class="empty">暂无 SSE — 打开使用 EventSource 的页面</li>';
    return;
  }
  el.innerHTML = frames.map((f) => {
    const time = new Date(f.t).toLocaleTimeString();
    if (f.type === "open") {
      return `<li class="type-open"><div class="meta">OPEN · ${time}</div><div class="url">${escapeHtml(f.url)}</div></li>`;
    }
    if (f.type === "error") {
      return `<li class="type-error"><div class="meta">ERROR · ${time}</div><div class="url">${escapeHtml(f.url)}</div></li>`;
    }
    return `<li class="type-message"><div class="meta">MESSAGE · ${time}</div><div class="data">${escapeHtml(f.data || "")}</div></li>`;
  }).join("");
}

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: "wire-list" });
  render(res?.frames || []);
}

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "wire-clear" });
  refresh();
});

refresh();
setInterval(refresh, 1000);
