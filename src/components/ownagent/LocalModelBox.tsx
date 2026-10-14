import { useState } from "react";
import { loadWebLlm, webLlmSupport, writeBriefLocally } from "../../lib/webLlmBrief";

export function LocalModelBox({ summary }: { summary?: string }) {
  const support = webLlmSupport();
  const [progress, setProgress] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(support.ok ? null : support.reason);
  const [brief, setBrief] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setNote(null);
    const res = await loadWebLlm(setProgress);
    setBusy(false);
    setReady(res.ok);
    if (!res.ok) setNote(res.reason);
  }

  async function write() {
    if (!summary?.trim()) return;
    setBusy(true);
    const res = await writeBriefLocally(summary);
    setBusy(false);
    if (!res.ok) {
      setBrief(null);
      setNote(res.reason);
      return;
    }
    setBrief(res.brief);
    setNote(`首字 ${res.ttftMs} ms${res.tokensPerSec ? ` · ${res.tokensPerSec} tokens/s` : ""}`);
  }

  return (
    <div className="oa-stack">
      <p className="oa-toolbar-lead">模型只在你点下载后才拉取。写出来的说明如果和计算结果的数字对不上，会丢掉，结论仍以引擎为准。</p>
      {note ? <p className="oa-toolbar-lead">{note}</p> : null}
      {progress ? <p className="oa-toolbar-lead">{progress}</p> : null}
      <button type="button" className="oa-bar-btn" disabled={!support.ok || busy} onClick={() => void download()}>
        {busy ? "处理中…" : ready ? "模型已在本机" : "下载本地模型"}
      </button>
      {summary ? (
        <button type="button" className="oa-bar-btn" disabled={!ready || busy} onClick={() => void write()}>
          用本机模型写说明
        </button>
      ) : null}
      {brief ? <p className="oa-toolbar-lead">{brief}</p> : null}
    </div>
  );
}
