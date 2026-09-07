(function () {
  if (window.__wireHooked) return;
  window.__wireHooked = true;

  const CHANNEL = "__wire_sse__";
  const Orig = window.EventSource;

  window.EventSource = function WireEventSource(url, config) {
    const es = new Orig(url, config);
    const id = crypto.randomUUID();
    const src = String(url);

    window.dispatchEvent(new CustomEvent(CHANNEL, {
      detail: { type: "open", id, url: src, t: Date.now() },
    }));

    es.addEventListener("message", (ev) => {
      window.dispatchEvent(new CustomEvent(CHANNEL, {
        detail: { type: "message", id, url: src, data: String(ev.data).slice(0, 2000), t: Date.now() },
      }));
    });

    es.addEventListener("error", () => {
      window.dispatchEvent(new CustomEvent(CHANNEL, {
        detail: { type: "error", id, url: src, t: Date.now() },
      }));
    });

    return es;
  };
  window.EventSource.prototype = Orig.prototype;
  window.EventSource.CONNECTING = Orig.CONNECTING;
  window.EventSource.OPEN = Orig.OPEN;
  window.EventSource.CLOSED = Orig.CLOSED;
})();
