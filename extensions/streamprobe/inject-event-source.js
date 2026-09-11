(function () {
  if (window.__streamProbeEsHooked) return;
  window.__streamProbeEsHooked = true;

  const Orig = window.EventSource;

  function emit(detail) {
    window.postMessage({ __streamprobe__: true, detail }, "*");
  }

  window.EventSource = function StreamProbeEventSource(url, config) {
    const es = new Orig(url, config);
    const connectionId = crypto.randomUUID();
    const src = String(url);

    emit({
      phase: "open",
      kind: "eventsource",
      connectionId,
      url: src,
      t: Date.now(),
    });

    es.addEventListener("message", (ev) => {
      emit({
        phase: "message",
        kind: "eventsource",
        connectionId,
        url: src,
        raw: String(ev.data).slice(0, 8000),
        eventName: ev.type,
        t: Date.now(),
      });
    });

    es.addEventListener("error", () => {
      emit({
        phase: "error",
        kind: "eventsource",
        connectionId,
        url: src,
        t: Date.now(),
      });
    });

    return es;
  };
  window.EventSource.prototype = Orig.prototype;
  window.EventSource.CONNECTING = Orig.CONNECTING;
  window.EventSource.OPEN = Orig.OPEN;
  window.EventSource.CLOSED = Orig.CLOSED;
})();
