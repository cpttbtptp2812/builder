/** 注入 MAIN world — 劫持 fetch / XHR */
(function () {
  if (window.__mirrorHooked) return;
  window.__mirrorHooked = true;

  const CHANNEL = "__mirror_channel__";

  function emit(entry) {
    window.dispatchEvent(new CustomEvent(CHANNEL, { detail: entry }));
  }

  function parseReq(input, init) {
    let url = "";
    let method = "GET";
    if (typeof input === "string") url = input;
    else if (input instanceof Request) {
      url = input.url;
      method = input.method;
    }
    if (init?.method) method = init.method;
    let body = init?.body;
    if (body && typeof body !== "string") {
      try { body = JSON.stringify(body); } catch { body = String(body); }
    }
    return { url, method: method.toUpperCase(), body: body || null };
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async function mirrorFetch(input, init) {
    const req = parseReq(input, init);
    const id = crypto.randomUUID();
    const t0 = performance.now();
    emit({ phase: "start", id, kind: "fetch", ...req, t: Date.now() });

    try {
      const res = await origFetch(input, init);
      const clone = res.clone();
      let bodyPreview = "";
      try {
        const text = await clone.text();
        bodyPreview = text.slice(0, 800);
      } catch { /* ignore */ }
      emit({
        phase: "end",
        id,
        ok: res.ok,
        status: res.status,
        ms: Math.round(performance.now() - t0),
        bodyPreview,
      });
      return res;
    } catch (err) {
      emit({
        phase: "end",
        id,
        ok: false,
        status: 0,
        ms: Math.round(performance.now() - t0),
        error: err?.message || "fetch failed",
      });
      throw err;
    }
  };

  const XO = XMLHttpRequest.prototype.open;
  const XS = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__mirror = { method: (method || "GET").toUpperCase(), url: String(url) };
    return XO.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const meta = this.__mirror || { method: "GET", url: "" };
    const id = crypto.randomUUID();
    const t0 = performance.now();
    emit({ phase: "start", id, kind: "xhr", ...meta, body: body ? String(body).slice(0, 400) : null, t: Date.now() });

    this.addEventListener("loadend", () => {
      let bodyPreview = "";
      try {
        bodyPreview = String(this.responseText || "").slice(0, 800);
      } catch { /* ignore */ }
      emit({
        phase: "end",
        id,
        ok: this.status >= 200 && this.status < 400,
        status: this.status,
        ms: Math.round(performance.now() - t0),
        bodyPreview,
      });
    });

    return XS.call(this, body);
  };
})();
