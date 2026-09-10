/** 页面加载：文字匹配优先，坐标辅助消歧，无文字再用坐标 */
(function () {
  const HIGHLIGHT_STYLE = "clip-hub-highlight";
  const STYLE_ID = "clip-hub-highlight-style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      mark.${HIGHLIGHT_STYLE} {
        background: rgba(94, 234, 212, 0.45) !important;
        outline: 2px solid #0d9488;
        border-radius: 2px;
        animation: clip-hub-pulse 1.2s ease 2;
      }
      @keyframes clip-hub-pulse {
        0%, 100% { outline-color: #0d9488; }
        50% { outline-color: #5eead4; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function normalizeText(text) {
    return String(text).replace(/\s+/g, " ").trim();
  }

  function getDocumentY(range) {
    const rect = range.getBoundingClientRect();
    if (!rect.height && !rect.width) return null;
    return window.scrollY + rect.top;
  }

  function buildNeedles(text) {
    const trimmed = normalizeText(text);
    if (!trimmed) return [];
    const needles = [trimmed.slice(0, 120)];
    if (trimmed.length > 60) needles.push(trimmed.slice(0, 60));
    if (trimmed.length > 30) needles.push(trimmed.slice(0, 30));
    return [...new Set(needles.filter(Boolean))];
  }

  function isSkippedNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest(`script, style, noscript, mark.${HIGHLIGHT_STYLE}`));
  }

  function rangeFromNode(node, start, len) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, Math.min(start + len, node.textContent.length));
    return range;
  }

  /** 在文本节点中找所有匹配 */
  function findMatchesInTextNodes(needles) {
    const matches = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent || isSkippedNode(node)) continue;
      const raw = node.textContent;

      for (const needle of needles) {
        let start = 0;
        while (start <= raw.length - needle.length) {
          const idx = raw.indexOf(needle, start);
          if (idx < 0) break;
          try {
            const range = rangeFromNode(node, idx, needle.length);
            const docY = getDocumentY(range);
            if (docY != null) {
              const key = `${Math.round(docY / 8)}|${needle.length}|${idx}`;
              if (!seen.has(key)) {
                seen.add(key);
                matches.push({ range, needle, docY, needleLen: needle.length });
              }
            }
          } catch {
            /* 跳过无效 range */
          }
          start = idx + 1;
        }
      }
    }
    return matches;
  }

  /** 跨节点：在块级元素 innerText 中匹配 */
  function findMatchesInBlocks(needles) {
    const matches = [];
    const seen = new Set();
    const selector =
      "p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, pre, dd, figcaption, span, a, label";

    for (const el of document.querySelectorAll(selector)) {
      if (el.closest(`script, style, noscript, mark.${HIGHLIGHT_STYLE}`)) continue;
      if (el.querySelector(selector)) continue;
      const blockText = normalizeText(el.innerText || "");
      if (!blockText) continue;

      for (const needle of needles) {
        if (!blockText.includes(needle)) continue;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent || isSkippedNode(node)) continue;
          const idx = node.textContent.indexOf(needle);
          if (idx < 0) continue;
          try {
            const range = rangeFromNode(node, idx, needle.length);
            const docY = getDocumentY(range);
            if (docY != null) {
              const key = `${Math.round(docY / 8)}|${needle.length}`;
              if (!seen.has(key)) {
                seen.add(key);
                matches.push({ range, needle, docY, needleLen: needle.length });
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
    return matches;
  }

  function findAllTextMatches(text) {
    const needles = buildNeedles(text);
    if (!needles.length) return [];
    const nodeMatches = findMatchesInTextNodes(needles);
    if (nodeMatches.length) return nodeMatches;
    return findMatchesInBlocks(needles);
  }

  /** 多处相同文字时，优先与保存坐标相近的那一处 */
  function pickBestMatch(matches, savedScrollY) {
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];

    const y =
      savedScrollY != null && !Number.isNaN(Number(savedScrollY))
        ? Number(savedScrollY)
        : null;
    const tolerance = Math.max(900, window.innerHeight * 1.5);

    const rank = (list) =>
      [...list].sort((a, b) => {
        if (b.needleLen !== a.needleLen) return b.needleLen - a.needleLen;
        if (y == null) return 0;
        return Math.abs(a.docY - y) - Math.abs(b.docY - y);
      });

    if (y != null) {
      const nearby = matches.filter((m) => Math.abs(m.docY - y) <= tolerance);
      if (nearby.length) return rank(nearby)[0];
    }
    return rank(matches)[0];
  }

  function scrollToY(y) {
    const top = Number(y);
    if (Number.isNaN(top)) return false;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    return true;
  }

  function scrollRangeIntoView(range) {
    const rect = range.getBoundingClientRect();
    if (!rect.height && !rect.width) return false;
    const target = window.scrollY + rect.top - window.innerHeight * 0.3;
    window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    return true;
  }

  function highlightRange(range) {
    ensureStyle();
    try {
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_STYLE;
      range.surroundContents(mark);
      mark.scrollIntoView({ block: "center", behavior: "smooth" });
      return true;
    } catch {
      return scrollRangeIntoView(range);
    }
  }

  function jumpByText(text, scrollY) {
    const matches = findAllTextMatches(text);
    const best = pickBestMatch(matches, scrollY);
    if (!best) return false;
    return highlightRange(best.range);
  }

  function applyJump({ scrollY, text }) {
    if (text?.trim()) {
      if (jumpByText(text, scrollY)) return true;
    }
    if (scrollY != null) return scrollToY(scrollY);
    return false;
  }

  function applyJumpWithRetry(payload, triesLeft = 10) {
    if (applyJump(payload)) return;
    if (triesLeft <= 0) {
      if (payload.scrollY != null) scrollToY(payload.scrollY);
      return;
    }
    setTimeout(() => applyJumpWithRetry(payload, triesLeft - 1), 350);
  }

  function scrollFromHash() {
    const m = location.hash.match(/^#clip-hub-y=(\d+)$/);
    if (!m) return;
    const y = parseInt(m[1], 10);
    if (Number.isNaN(y)) return;
    applyJumpWithRetry({ scrollY: y, text: "" }, 8);
  }

  scrollFromHash();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "clip-hub-jump") {
      applyJumpWithRetry({
        scrollY: msg.scrollY ?? null,
        text: msg.text || "",
      });
    }
    if (msg.type === "clip-hub-highlight") {
      applyJumpWithRetry({ scrollY: msg.scrollY ?? null, text: msg.text || "" }, 6);
    }
  });
})();
