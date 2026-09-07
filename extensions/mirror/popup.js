function toCurl(row) {
  const parts = [`curl -X ${row.method}`];
  parts.push(`'${row.url.replace(/'/g, "'\\''")}'`);
  if (row.body) {
    parts.push(`-H 'Content-Type: application/json'`);
    parts.push(`-d '${String(row.body).replace(/'/g, "'\\''")}'`);
  }
  return parts.join(" ");
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderLogs(logs) {
  const el = document.getElementById("log");
  if (!logs.length) {
    el.innerHTML = '<li class="empty">暂无请求 — 刷新页面或触发 API 调用</li>';
    return;
  }
  el.innerHTML = logs.map((row) => {
    const st = row.status != null ? row.status : "…";
    const stClass = row.ok === false ? "status-fail" : row.ok ? "status-ok" : "";
    return `<li><button type="button" data-id="${row.id}">
      <div class="row-top">
        <span class="method">${row.method}</span>
        <span class="url">${escapeHtml(row.url)}</span>
        <span class="${stClass}">${st}</span>
      </div>
      <div class="meta">${row.kind} · ${row.ms != null ? row.ms + "ms" : "pending"} · 点击复制 curl</div>
    </button></li>`;
  }).join("");

  const map = new Map(logs.map((r) => [r.id, r]));
  el.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = map.get(btn.dataset.id);
      if (!row) return;
      await navigator.clipboard.writeText(toCurl(row));
      btn.style.borderColor = "#34d399";
      setTimeout(() => { btn.style.borderColor = ""; }, 700);
    });
  });
}

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: "mirror-list" });
  renderLogs(res?.logs || []);
}

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "mirror-clear" });
  refresh();
});

async function refreshMocks() {
  const res = await chrome.runtime.sendMessage({ type: "mirror-get-mocks" });
  const mocks = res?.mocks || {};
  const list = document.getElementById("mock-list");
  const entries = Object.entries(mocks);
  if (!entries.length) {
    list.innerHTML = "<li>暂无 Mock</li>";
    return;
  }
  list.innerHTML = entries.map(([pat]) =>
    `<li><span>${escapeHtml(pat)}</span><button type="button" data-pat="${escapeHtml(pat)}">删</button></li>`
  ).join("");
  list.querySelectorAll("button[data-pat]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "mirror-del-mock", pattern: btn.dataset.pat });
      refreshMocks();
    });
  });
}

document.getElementById("mock-save").addEventListener("click", async () => {
  const pattern = document.getElementById("mock-pattern").value.trim();
  const body = document.getElementById("mock-body").value.trim();
  if (!pattern) return;
  await chrome.runtime.sendMessage({ type: "mirror-set-mock", pattern, body, status: 200 });
  refreshMocks();
});

refresh();
refreshMocks();
setInterval(refresh, 1200);
