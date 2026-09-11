(function () {
  if (window.__streamProbeFetchHooked) return;
  window.__streamProbeFetchHooked = true;

  const origFetch = window.fetch.bind(window);

  function isStreamContentType(ct) {
    if (!ct) return false;
    const lower = ct.toLowerCase();
    return (
      lower.includes("text/event-stream") ||
      lower.includes("application/x-ndjson") ||
      lower.includes("ndjson") ||
      lower.includes("stream")
    );
  }

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof Request) return input.url;
    return String(input);
  }

  function emit(detail) {
    window.postMessage({ __streamprobe__: true, detail }, "*");
  }

  function flushLines(connectionId, url, buffer, carry) {
    const combined = carry + buffer;
    const parts = combined.split("\n");
    const rest = parts.pop() || "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      emit({
        phase: "message",
        kind: "fetch-stream",
        connectionId,
        url,
        raw: trimmed.slice(0, 8000),
        t: Date.now(),
      });
    }
    return rest;
  }

  window.fetch = async function streamProbeFetch(input, init) {
    const res = await origFetch(input, init);
    try {
      const ct = res.headers.get("content-type") || "";
      if (!isStreamContentType(ct) || !res.body) return res;

      const connectionId = crypto.randomUUID();
      const url = requestUrl(input);

      emit({
        phase: "open",
        kind: "fetch-stream",
        connectionId,
        url,
        t: Date.now(),
      });

      const [tap, web] = res.body.tee();
      const reader = tap.getReader();
      const decoder = new TextDecoder();
      let carry = "";

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (carry.trim()) {
                emit({
                  phase: "message",
                  kind: "fetch-stream",
                  connectionId,
                  url,
                  raw: carry.trim().slice(0, 8000),
                  t: Date.now(),
                });
              }
              emit({ phase: "close", kind: "fetch-stream", connectionId, url, t: Date.now() });
              break;
            }
            carry = flushLines(connectionId, url, decoder.decode(value, { stream: true }), carry);
          }
        } catch (err) {
          emit({
            phase: "error",
            kind: "fetch-stream",
            connectionId,
            url,
            raw: String(err?.message || err).slice(0, 500),
            t: Date.now(),
          });
        }
      })();

      return new Response(web, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch {
      return res;
    }
  };
})();
