import { useState } from "react";

import { gzipText, gunzipText } from "../../lib/compression";

import { mkTech, type TechEvent } from "../../lib/techLog";

import { TechEventLog } from "./TechEventLog";



const SAMPLE = {

  workflowId: "w1",

  steps: Array.from({ length: 48 }, (_, i) => ({

    id: i,

    selector: `table.sku-list >> tr:nth(${i})`,

    action: i % 3 === 0 ? "click" : "input",

    payload: { sku: `A-${1000 + i}`, price: 99 + i },

  })),

};



/** CompressionStream API — 步骤队列 gzip */

export function CompressionLab() {

  const [running, setRunning] = useState(false);

  const [rawBytes, setRawBytes] = useState(0);

  const [gzipBytes, setGzipBytes] = useState(0);

  const [verified, setVerified] = useState<boolean | null>(null);

  const [logs, setLogs] = useState<TechEvent[]>([]);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  async function run() {

    setRunning(true);

    setVerified(null);

    setLogs([]);

    const json = JSON.stringify(SAMPLE);

    push("JSON.stringify", `48 步队列 · ${json.length} 字符`, "stage");

    push("CompressionStream", `'gzip' · new Blob([json]).stream().pipeThrough(...)`, "stage");

    const { rawBytes: raw, gzipBytes: gz, gzip, supported } = await gzipText(json);

    setRawBytes(raw);

    setGzipBytes(gz);

    push("ReadableStream", `gzip 输出 ${gz} bytes（原始 ${raw} bytes）`, "ok");

    if (supported && gzip) {

      push("DecompressionStream", "round-trip 解压校验", "stage");

      const back = await gunzipText(gzip);

      const ok = back === json;

      setVerified(ok);

      push("校验", ok ? "DecompressionStream ✓ 数据一致" : "✗ round-trip 失败", ok ? "ok" : "fail");

      push("IndexedDB.put", "压缩 Uint8Array 分片写入（演示省略）", "storage");

    } else {

      push("降级", "浏览器不支持 CompressionStream", "fail");

    }

    setRunning(false);

  }



  const saved = rawBytes > 0 ? Math.round((1 - gzipBytes / rawBytes) * 100) : 0;



  return (

    <div className="tech-lab-with-log">

      <div className="tech-lab">

        <header className="tech-lab-head">

          <div>

            <h3>步骤队列压缩</h3>

            <p>CompressionStream / DecompressionStream · 浏览器原生 gzip</p>

          </div>

          <button type="button" className="cta sm" onClick={() => void run()} disabled={running}>

            {running ? "压缩中…" : "gzip 队列"}

          </button>

        </header>



        <div className="compress-stats">

          <div><span>原始 JSON</span><strong>{rawBytes || "—"} B</strong></div>

          <div><span>gzip 后</span><strong>{gzipBytes || "—"} B</strong></div>

          <div><span>体积减少</span><strong>{rawBytes ? `${saved}%` : "—"}</strong></div>

          <div><span>DecompressionStream</span><strong className={verified === true ? "ok" : verified === false ? "fail" : ""}>

            {verified === null ? "—" : verified ? "✓ round-trip" : "✗ fail"}

          </strong></div>

        </div>



        <pre className="tech-code">{`new Blob([queue]).stream()

  .pipeThrough(new CompressionStream("gzip"))

  → IndexedDB.put(compressed)`}</pre>

      </div>

      <TechEventLog events={logs} empty="点 gzip 队列，看 CompressionStream 调用链…" />

    </div>

  );

}


