/** Focus 阅读模式 */
(function () {
  const ROOT_ID = "focus-reader-root";
  const STYLE_ID = "focus-reader-style";

  function extractArticle() {
    const selectors = [
      "article",
      "[role=main]",
      "main",
      ".post-content",
      ".article-content",
      ".entry-content",
      "#content",
      ".content",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && (el.innerText || "").trim().length > 400) return el.cloneNode(true);
    }
    const candidates = [...document.querySelectorAll("p")].map((p) => p.closest("div, section, article") || p);
    const scored = new Map();
    for (const el of candidates) {
      if (!el || el.closest("nav, header, footer, aside, script, style")) continue;
      const text = (el.innerText || "").trim();
      if (text.length < 200) continue;
      const score = text.length + (el.querySelectorAll("p").length * 80);
      const prev = scored.get(el) || 0;
      if (score > prev) scored.set(el, score);
    }
    let best = null, bestScore = 0;
    for (const [el, score] of scored) {
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best ? best.cloneNode(true) : null;
  }

  function enable(theme = "dark") {
    if (document.getElementById(ROOT_ID)) return { ok: true, already: true };
    const article = extractArticle();
    if (!article) return { ok: false, error: "未找到可读正文，换一篇文章页面试试" };

    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.focus-reader-active, html.focus-reader-active body {
        overflow: hidden !important;
        background: ${theme === "light" ? "#faf8f5" : "#0c0f14"} !important;
      }
    `;
    document.documentElement.appendChild(style);
    document.documentElement.classList.add("focus-reader-active");

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = `focus-theme-${theme}`;
    root.innerHTML = `
      <header class="focus-bar">
        <strong>Focus</strong>
        <span>阅读模式</span>
        <button type="button" id="focus-theme-toggle">${theme === "light" ? "深色" : "浅色"}</button>
        <button type="button" id="focus-close">退出</button>
      </header>
      <article class="focus-body"></article>
    `;
    root.querySelector(".focus-body").appendChild(article);
    document.body.appendChild(root);

    root.querySelector("#focus-close").addEventListener("click", disable);
    root.querySelector("#focus-theme-toggle").addEventListener("click", () => {
      const next = root.classList.contains("focus-theme-light") ? "dark" : "light";
      disable();
      enable(next);
    });

    return { ok: true };
  }

  function disable() {
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement.classList.remove("focus-reader-active");
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg.type === "focus-toggle") {
      if (document.getElementById(ROOT_ID)) sendResponse(disable());
      else sendResponse(enable(msg.theme || "dark"));
      return true;
    }
    if (msg.type === "focus-status") {
      sendResponse({ active: Boolean(document.getElementById(ROOT_ID)) });
      return true;
    }
  });
})();
