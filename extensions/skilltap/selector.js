(function (root) {
  function cssEscape(value) {
    const s = String(value);
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(s);
    }
    return s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function visible(el) {
    if (!(el instanceof Element)) return false;
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (!style || style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function implicitRole(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "input") {
      if (type === "submit" || type === "button" || type === "reset" || type === "image") return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "file") return "button";
      return "textbox";
    }
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "option") return "option";
    if (/^h[1-6]$/.test(tag)) return "heading";
    return el.getAttribute("role") || "";
  }

  function accessibleName(el) {
    const labelled = el.getAttribute("aria-labelledby");
    if (labelled) {
      const text = labelled
        .split(/\s+/)
        .map((id) => el.ownerDocument.getElementById(id)?.innerText?.trim())
        .filter(Boolean)
        .join(" ");
      if (text) return text.slice(0, 80);
    }
    const label = el.getAttribute("aria-label");
    if (label) return label.trim().slice(0, 80);
    if (el.id) {
      const forLabel = el.ownerDocument.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (forLabel?.innerText) return forLabel.innerText.trim().slice(0, 80);
    }
    const wrap = el.closest("label");
    if (wrap?.innerText) {
      const t = wrap.innerText.trim();
      if (t.length && t.length < 80) return t;
    }
    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return placeholder.trim().slice(0, 80);
    const alt = el.getAttribute("alt") || el.getAttribute("title");
    if (alt) return alt.trim().slice(0, 80);
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (text && text.length < 80) return text;
    return "";
  }

  function uniqueBy(doc, selector) {
    try {
      return doc.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  function attrSelector(el) {
    const doc = el.ownerDocument;
    if (el.id && uniqueBy(doc, `#${cssEscape(el.id)}`)) {
      return `#${cssEscape(el.id)}`;
    }
    for (const attr of ["data-testid", "data-test", "data-qa", "data-cy", "name"]) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const sel = `[${attr}="${cssEscape(value)}"]`;
      if (uniqueBy(doc, sel)) return sel;
    }
    return "";
  }

  function nthPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node.tagName !== "HTML") {
      const tagged = attrSelector(node);
      if (tagged) {
        parts.unshift(tagged);
        break;
      }
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent || tag === "body") {
        parts.unshift(tag);
        break;
      }
      const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
      const idx = siblings.indexOf(node) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${idx})` : tag);
      node = parent;
    }
    return parts.join(" > ");
  }

  function uniqueSelector(el) {
    if (!(el instanceof Element)) return "";
    const direct = attrSelector(el);
    if (direct) return direct;
    return nthPath(el);
  }

  function describe(el) {
    if (!(el instanceof Element)) return null;
    const interactive = el.closest(
      "a, button, input, textarea, select, [role='button'], [role='link'], [contenteditable='true']",
    );
    const target = interactive || el;
    if (!(target instanceof Element) || target.closest("[data-skilltap]")) return null;
    const href = target.tagName === "A" ? target.getAttribute("href") : "";
    let abs = "";
    try {
      if (href) abs = new URL(href, target.ownerDocument.baseURI).href;
    } catch {
      abs = href || "";
    }
    return {
      selector: uniqueSelector(target),
      tag: target.tagName.toLowerCase(),
      type: (target.getAttribute("type") || "").toLowerCase(),
      role: implicitRole(target),
      name: accessibleName(target),
      href: abs,
      id: target.id || "",
    };
  }

  root.SkillTapSelector = { cssEscape, visible, implicitRole, accessibleName, uniqueSelector, describe };
})(typeof self !== "undefined" ? self : globalThis);
