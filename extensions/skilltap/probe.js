(() => {
  if (window.__SKILLTAP_PROBE__) return;
  window.__SKILLTAP_PROBE__ = true;

  const send = (payload) => {
    try {
      window.postMessage({ source: "skilltap", ...payload }, "*");
    } catch {
      /* ignore */
    }
  };

  window.addEventListener("error", (e) => {
    send({
      kind: "error",
      message: String(e.message || e.error || "error"),
      file: e.filename || "",
      line: e.lineno || 0,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    send({ kind: "error", message: `Unhandled: ${String(e.reason || "")}`.slice(0, 500) });
  });

  const origError = console.error;
  console.error = function (...args) {
    const message = args
      .map((a) => {
        try {
          return typeof a === "string" ? a : JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ")
      .slice(0, 500);
    send({ kind: "error", message });
    return origError.apply(this, args);
  };

  if (typeof fetch === "function") {
    const origFetch = fetch;
    window.fetch = function (...args) {
      return origFetch.apply(this, args).then((res) => {
        if (res && res.status >= 400) {
          send({ kind: "net", status: res.status, url: String(res.url || args[0] || "") });
        }
        return res;
      });
    };
  }
})();
