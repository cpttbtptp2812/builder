import { useState } from "react";

import { TechBadgeBar } from "../components/TechBadgeBar";

import { WorkGuide } from "../components/WorkGuide";

import { TechEventLog } from "../components/tech/TechEventLog";

import { mkTech, type TechEvent } from "../lib/techLog";



const RECORDED = [

  { action: "inject", target: "shadow-root", ts: 0 },

  { action: "highlight", selector: "input#email", ts: 120 },

  { action: "input", selector: "input#email", value: "ops@demo.local", ts: 340 },

  { action: "click", selector: "button[type=submit]", ts: 580 },

];



/** Chrome Extension · MV3 录制 → steps.json */

export function WorkExtension() {

  const [on, setOn] = useState(false);

  const [step, setStep] = useState(-1);

  const [done, setDone] = useState(false);

  const [logs, setLogs] = useState<TechEvent[]>([]);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  function run() {

    setOn(true);

    setDone(false);

    setStep(-1);

    setLogs([]);

    push("chrome.storage.session", "录制状态持久化 · MV3 service worker 可被杀", "storage");

    push("Content Script", "document.addEventListener('click', serialize, true) 捕获阶段", "stage");

    let i = 0;

    const t = window.setInterval(() => {

      const rec = RECORDED[i]!;

      setStep(i);

      if (rec.action === "highlight") push("overlay", `getBoundingClientRect → fixed div 高亮 ${rec.selector}`, "render");

      if (rec.action === "input") push("serializeStep", `{ action: 'input', selector: '${rec.selector}' }`, "ok");

      if (rec.action === "click") push("serializeStep", `{ action: 'click', selector: '${rec.selector}' }`, "ok");

      i += 1;

      if (i >= RECORDED.length) {

        window.clearInterval(t);

        setDone(true);

        push("steps.json", `输出 ${RECORDED.length} 步 · schema 对齐 Builder/SDK`, "ok");

      }

    }, 750);

  }



  return (

    <div className="work-ext work-tech-lab">

      <WorkGuide slug="extension" />

      <TechBadgeBar items={["MV3", "Content Script", "chrome.storage", "steps.json"]} />



      <div className="work-demo-bar">

        <button type="button" className="cta" onClick={run} disabled={on && !done}>

          {on && !done ? "录制中…" : done ? "重新录制" : "▶ 开始录制"}

        </button>

        <span className="work-demo-bar-hint">isolated world · 零 DOM 污染</span>

      </div>



      <div className="tech-lab-with-log">

        <div className="ext-layout">

          <div className="ext-chrome">

            <div className="ext-toolbar">

              <span>Content Script · isolated world</span>

              {on && step >= 0 && <em className="live-badge">REC</em>}

            </div>

            <div className="ext-page">

              <h3>电商后台 · 登录</h3>

              <label className={on && step >= 1 ? "ext-hl" : ""}>

                邮箱

                <input id="email" readOnly value={on && step >= 2 ? "ops@demo.local" : ""} />

              </label>

              <label>

                密码

                <input type="password" readOnly value="••••••" />

              </label>

              <button type="button" className={on && step >= 3 ? "ext-hl" : ""}>

                登录

              </button>

            </div>

          </div>



          <div className="ext-output">

            <header>steps.json 输出</header>

            <pre>{JSON.stringify(done ? RECORDED : RECORDED.slice(0, Math.max(0, step + 1)), null, 2)}</pre>

            {done && <p className="ext-import">→ import Builder / SDK 共用 schema</p>}

          </div>

        </div>

        <TechEventLog events={logs} empty="点开始录制，看 MV3 / Content Script API…" />

      </div>

    </div>

  );

}


