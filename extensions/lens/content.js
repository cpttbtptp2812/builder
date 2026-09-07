/** 检测 JSON 页面并注入美化层 */
(function () {
  if (window.__lensInjected) return;
  window.__lensInjected = true;

  function tryParseJson(text) {
    const t = text.trim();
    if (!t || (t[0] !== "{" && t[0] !== "[")) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }

  function isJsonPage() {
    const ct = document.contentType || "";
    if (ct.includes("json")) return true;
    if (document.body?.childElementCount === 1 && document.body.firstElementChild?.tagName === "PRE") {
      return tryParseJson(document.body.textContent || "") != null;
    }
    const raw = (document.body?.innerText || "").trim();
    if (raw.length > 2 && raw.length < 5_000_000) return tryParseJson(raw) != null;
    return false;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderValue(val, depth = 0) {
    if (val === null) return '<span class="l-null">null</span>';
    if (typeof val === "boolean") return `<span class="l-bool">${val}</span>`;
    if (typeof val === "number") return `<span class="l-num">${val}</span>`;
    if (typeof val === "string") return `<span class="l-str">"${escapeHtml(val)}"</span>`;
    if (Array.isArray(val)) {
      if (!val.length) return "[]";
      const items = val.map((v) => `<li>${renderValue(v, depth + 1)}</li>`).join("");
      return `<ul class="l-arr">${items}</ul>`;
    }
    const keys = Object.keys(val);
    if (!keys.length) return "{}";
    const rows = keys.map((k) =>
      `<li><span class="l-key">"${escapeHtml(k)}"</span>: ${renderValue(val[k], depth + 1)}</li>`
    ).join("");
    return `<ul class="l-obj">${rows}</ul>`;
  }

  function injectViewer(data) {
    const root = document.createElement("div");
    root.id = "lens-root";
    root.innerHTML = `
      <style>
        #lens-root {
          position: fixed; inset: 0; z-index: 2147483646;
          background: #0b1020; color: #e2e8f0;
          font: 13px/1.5 "JetBrains Mono", "Cascadia Code", Consolas, monospace;
          overflow: auto; padding: 1.25rem;
        }
        #lens-bar {
          position: sticky; top: 0; z-index: 2;
          display: flex; gap: 0.5rem; align-items: center;
          padding-bottom: 0.75rem; margin-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: #0b1020;
        }
        #lens-bar strong { color: #38bdf8; font-size: 0.9rem; }
        #lens-bar button {
          margin-left: auto; padding: 0.35rem 0.75rem;
          border: 1px solid rgba(56,189,248,0.4); border-radius: 0.4rem;
          background: rgba(56,189,248,0.12); color: #7dd3fc;
          cursor: pointer; font: inherit;
        }
        .l-key { color: #a78bfa; }
        .l-str { color: #86efac; }
        .l-num { color: #fbbf24; }
        .l-bool { color: #f472b6; }
        .l-null { color: #64748b; }
        ul { list-style: none; margin: 0; padding-left: 1.1rem; }
        li { margin: 0.15rem 0; }
      </style>
      <div id="lens-bar">
        <strong>Lens</strong>
        <span>JSON 树形视图</span>
        <button type="button" id="lens-copy">复制格式化 JSON</button>
        <button type="button" id="lens-close">关闭</button>
      </div>
      <div id="lens-tree"></div>
    `;
    document.documentElement.appendChild(root);
    root.querySelector("#lens-tree").innerHTML = renderValue(data);
    root.querySelector("#lens-close").addEventListener("click", () => root.remove());
    root.querySelector("#lens-copy").addEventListener("click", async () => {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      root.querySelector("#lens-copy").textContent = "已复制 ✓";
    });
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg.type === "lens-format-selection") {
      const sel = window.getSelection()?.toString() || "";
      const data = tryParseJson(sel);
      if (!data) {
        sendResponse({ ok: false, error: "选区不是有效 JSON" });
        return;
      }
      injectViewer(data);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "lens-format-page") {
      const raw = (document.body?.innerText || "").trim();
      const data = tryParseJson(raw);
      if (!data) {
        sendResponse({ ok: false, error: "当前页不是 JSON" });
        return;
      }
      injectViewer(data);
      sendResponse({ ok: true });
    }
  });

  if (isJsonPage()) {
    const raw = document.body?.firstElementChild?.tagName === "PRE"
      ? document.body.textContent
      : document.body.innerText;
    const data = tryParseJson(raw || "");
    if (data) setTimeout(() => injectViewer(data), 60);
  }
})();
