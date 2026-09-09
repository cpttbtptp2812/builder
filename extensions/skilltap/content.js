(() => {
  if (window.__SKILLTAP_BOUND__) return;
  window.__SKILLTAP_BOUND__ = true;

  const Selector = self.SkillTapSelector;
  let recording = false;
  let lastGoto = "";
  let fillTimer = 0;
  let pendingFill = null;

  function hud() {
    let el = document.getElementById("skilltap-hud");
    if (el) return el;
    el = document.createElement("div");
    el.id = "skilltap-hud";
    el.dataset.skilltap = "hud";
    el.setAttribute("data-skilltap", "hud");
    el.textContent = "正在记录步骤";
    Object.assign(el.style, {
      position: "fixed",
      zIndex: "2147483646",
      left: "12px",
      bottom: "12px",
      padding: "6px 10px",
      borderRadius: "999px",
      background: "rgba(190, 18, 60, 0.92)",
      color: "#fff7ed",
      font: "600 12px/1.2 system-ui, sans-serif",
      letterSpacing: "0.04em",
      boxShadow: "0 8px 24px rgba(127, 29, 29, 0.35)",
      pointerEvents: "none",
    });
    document.documentElement.appendChild(el);
    return el;
  }

  function setHud(on) {
    const el = hud();
    el.style.display = on ? "block" : "none";
  }

  function skip(target) {
    return Boolean(target?.closest?.("[data-skilltap]"));
  }

  function pageUrl() {
    return location.href;
  }

  function pointerFromEvent(ev) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    return { xPct: (ev.clientX / w) * 100, yPct: (ev.clientY / h) * 100 };
  }

  function pointerFromEl(el) {
    if (!(el instanceof Element)) return {};
    const r = el.getBoundingClientRect();
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    return {
      xPct: ((r.left + r.width / 2) / w) * 100,
      yPct: ((r.top + r.height / 2) / h) * 100,
    };
  }

  function pageMeta() {
    return {
      title: document.title || "",
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  }

  function emit(step) {
    if (!recording) return;
    chrome.runtime
      .sendMessage({
        type: "skilltap-step",
        step: { ...pageMeta(), ...step, url: step.url || pageUrl(), ts: Date.now() },
      })
      .catch(() => {});
  }

  function flushFill() {
    if (!pendingFill) return;
    emit(pendingFill);
    pendingFill = null;
  }

  function queueFill(step) {
    pendingFill = step;
    clearTimeout(fillTimer);
    fillTimer = window.setTimeout(() => {
      flushFill();
    }, 280);
  }

  function onClick(ev) {
    if (!recording || skip(ev.target)) return;
    const info = Selector.describe(ev.target);
    if (!info) return;
    if (info.tag === "input" || info.tag === "textarea" || info.tag === "select") {
      if (info.type === "checkbox" || info.type === "radio" || info.type === "file" || info.type === "submit" || info.type === "button") {
        /* keep */
      } else {
        return;
      }
    }
    if (info.type === "file") {
      emit({ action: "pause", reason: "选择本地文件", ...info });
      return;
    }
    emit({ action: "click", ...info, ...pointerFromEvent(ev) });
  }

  function onInput(ev) {
    if (!recording || skip(ev.target)) return;
    const el = ev.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    if (el.type === "checkbox" || el.type === "radio" || el.type === "file" || el.type === "button" || el.type === "submit") return;
    const info = Selector.describe(el);
    if (!info) return;
    const secret = el.type === "password" || el.autocomplete === "current-password";
    queueFill({
      action: "fill",
      ...info,
      ...pointerFromEl(el),
      value: secret ? "" : el.value,
      secret,
    });
  }

  function onChange(ev) {
    if (!recording || skip(ev.target)) return;
    const el = ev.target;
    if (el instanceof HTMLSelectElement) {
      const info = Selector.describe(el);
      if (!info) return;
      flushFill();
      emit({ action: "select", ...info, ...pointerFromEl(el), value: el.value });
    }
  }

  function onSubmit(ev) {
    if (!recording || skip(ev.target)) return;
    const form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;
    flushFill();
    const info = Selector.describe(form) || { selector: "", tag: "form", role: "", name: form.getAttribute("name") || "" };
    emit({ action: "submit", ...info });
  }

  function reportGoto() {
    const url = pageUrl();
    if (!recording || url === lastGoto) return;
    lastGoto = url;
    emit({ action: "goto", url });
  }

  function wrapHistory(method) {
    const orig = history[method];
    history[method] = function patched(...args) {
      const ret = orig.apply(this, args);
      queueMicrotask(reportGoto);
      return ret;
    };
  }

  wrapHistory("pushState");
  wrapHistory("replaceState");
  window.addEventListener("popstate", reportGoto);
  window.addEventListener("hashchange", reportGoto);

  document.addEventListener("click", onClick, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("submit", onSubmit, true);

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.data?.source !== "skilltap") return;
    if (!recording) return;
    chrome.runtime
      .sendMessage({
        type: "skilltap-log",
        log: {
          kind: ev.data.kind,
          message: ev.data.message,
          status: ev.data.status,
          url: ev.data.url || pageUrl(),
          file: ev.data.file,
          line: ev.data.line,
          ts: Date.now(),
        },
      })
      .catch(() => {});
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "skilltap-ping") {
      sendResponse({ ok: true, injected: true, recording });
      return;
    }
    if (msg?.type === "skilltap-set") {
      recording = Boolean(msg.recording);
      if (recording) {
        lastGoto = "";
        reportGoto();
        chrome.runtime
          .sendMessage({
            type: "skilltap-env",
            userAgent: navigator.userAgent,
            viewport: { w: window.innerWidth, h: window.innerHeight },
            title: document.title,
            url: pageUrl(),
          })
          .catch(() => {});
      } else {
        flushFill();
      }
      setHud(recording);
      sendResponse({ ok: true, recording });
    }
  });
})();
