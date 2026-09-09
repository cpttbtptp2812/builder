(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SkillTapPack = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  function getClean() {
    return (typeof globalThis !== "undefined" && globalThis.SkillTapClean) || {
      fileTitle: () => "操作手册.html",
      packStem: (n) => n || "操作手册",
      instruct: () => ({ title: "操作", body: "", link: "" }),
    };
  }

  function getAnalyze() {
    return (typeof globalThis !== "undefined" && globalThis.SkillTapAnalyze) || {
      analyze: () => [],
      levelLabel: (level) => level,
    };
  }

  function esc(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function jsonForScript(obj) {
    return JSON.stringify(obj).replace(/</g, "\\u003c");
  }

  function leanSteps(steps) {
    return (Array.isArray(steps) ? steps : []).map((s) => ({
      action: s.action,
      url: s.url,
      href: s.href,
      selector: s.selector,
      name: s.name,
      role: s.role,
      tag: s.tag,
      type: s.type,
      id: s.id,
      value: s.secret ? "" : s.value,
      secret: Boolean(s.secret),
      reason: s.reason,
      xPct: s.xPct,
      yPct: s.yPct,
      title: s.title,
      ts: s.ts,
    }));
  }

  function buildRepro(input) {
    const Clean = getClean();
    const Analyze = getAnalyze();
    const steps = leanSteps(input.steps);
    const logs = Array.isArray(input.logs) ? input.logs : [];
    const issue = String(input.issue || "").trim();
    const findings = Analyze.analyze({ steps, logs, issue });
    const startUrl = input.startUrl || steps.find((s) => s.url)?.url || "";
    return {
      tool: "skilltap",
      version: "1.2.0",
      name: String(input.name || "").trim() || "操作手册",
      description: String(input.description || "").trim(),
      issue,
      startUrl,
      userAgent: input.userAgent || "",
      viewport: input.viewport || null,
      recordedAt: input.recordedAt || new Date().toISOString(),
      steps,
      logs,
      findings,
    };
  }

  function buildDevMd(repro) {
    const Analyze = getAnalyze();
    const Clean = getClean();
    const when = repro.recordedAt
      ? new Date(repro.recordedAt).toLocaleString("zh-CN", { hour12: false })
      : "";
    const vp = repro.viewport ? `${repro.viewport.w}×${repro.viewport.h}` : "";
    const findings = (repro.findings || [])
      .map((f) => `- **[${Analyze.levelLabel(f.level)}]** ${f.title}${f.step ? `（第 ${f.step} 步）` : ""}：${f.detail}`)
      .join("\n");
    const steps = (repro.steps || [])
      .map((step, i) => {
        const info = Clean.instruct(step);
        const loc = [step.selector, step.role && step.name ? `${step.role}/${step.name}` : ""]
          .filter(Boolean)
          .join(" · ");
        return `${i + 1}. ${info.title} — ${info.body}${loc ? `\n   定位：\`${loc}\`` : ""}${step.url ? `\n   页面：${step.url}` : ""}`;
      })
      .join("\n");
    return `# 复现说明：${repro.name}

测试录制的操作包。开发打开手册 HTML 看演示，或把 \`repro.json\` 导入「步骤记录器」扩展，即可对照步骤和风险点，**不必先起本地项目**。

## 问题

${repro.issue || repro.description || "（测试未填写问题描述）"}

## 环境

- 入口：${repro.startUrl || "（无）"}
- 录制时间：${when || "（无）"}
- 视口：${vp || "（无）"}
- UA：${repro.userAgent || "（无）"}

## 可能的问题（根据录制自动分析）

${findings || "- （无）"}

## 怎么复现

${steps || "（无步骤）"}

## 文件

- \`操作手册.html\` — 给任何人看，可点「演示一遍」
- \`给开发.md\` — 本说明
- \`repro.json\` — 导入「步骤记录器」扩展，打开入口页、对照选择器
`;
  }

  function parseRepro(raw) {
    const text = String(raw || "").trim();
    if (!text) throw new Error("空文件");
    if (text.startsWith("{")) {
      const data = JSON.parse(text);
      if (data.tool === "skilltap" || Array.isArray(data.steps)) return data;
      throw new Error("不是步骤记录器的复现包");
    }
    const block = text.match(/<script type="application\/json" id="skilltap-repro">([\s\S]*?)<\/script>/i);
    if (block) return JSON.parse(block[1]);
    throw new Error("请选择 repro.json，或步骤记录器导出的 HTML / 复现包");
  }

  function buildManualHtml(input) {
    const Clean = getClean();
    const Analyze = getAnalyze();
    const repro = input.repro || buildRepro(input);
    const steps = Array.isArray(input.steps) ? input.steps : repro.steps;
    const title = repro.name;
    const intro = repro.description || "按下面的步骤做即可。点「演示一遍」会自动翻页讲解。";
    const when = repro.recordedAt
      ? new Date(repro.recordedAt).toLocaleString("zh-CN", { hour12: false })
      : "";
    const shotMap = input.shots && typeof input.shots === "object" ? input.shots : {};

    const cards = steps.map((step, i) => {
      const info = Clean.instruct(step);
      const img = shotMap[String(step.ts)] || shotMap[step.ts] || "";
      const x = Number(step.xPct);
      const y = Number(step.yPct);
      const pin =
        Number.isFinite(x) && Number.isFinite(y)
          ? `<i class="pin" style="left:${x}%;top:${y}%"></i>`
          : "";
      const link = info.link
        ? `<p class="go"><a href="${esc(info.link)}" target="_blank" rel="noreferrer">打开这个网址</a></p>`
        : "";
      const figure = img
        ? `<div class="shot">${pin}<img src="${img}" alt="第 ${i + 1} 步截图" /></div>`
        : `<div class="shot empty">这一步没有截到图，按文字说明操作即可。</div>`;
      return `<article class="card" id="s${i}" data-i="${i}">
  <span class="num">${i + 1}</span>
  <div>
    <h2>${esc(info.title)}</h2>
    <p>${esc(info.body)}</p>
    ${link}
    ${figure}
  </div>
</article>`;
    });

    const demo = steps.map((step) => {
      const info = Clean.instruct(step);
      return {
        title: info.title,
        body: info.body,
        link: info.link || "",
        shot: shotMap[String(step.ts)] || shotMap[step.ts] || "",
        xPct: step.xPct,
        yPct: step.yPct,
      };
    });

    const findingHtml = (repro.findings || [])
      .map(
        (f) =>
          `<li class="lv-${esc(f.level)}"><strong>[${esc(Analyze.levelLabel(f.level))}] ${esc(f.title)}</strong><span>${esc(f.detail)}</span></li>`,
      )
      .join("");

    const table = steps
      .map((step, i) => {
        const info = Clean.instruct(step);
        return `<tr>
  <td>${i + 1}</td>
  <td>${esc(info.title)}</td>
  <td><code>${esc(step.selector || step.role || "")}</code></td>
  <td>${esc(step.name || step.value || step.reason || "")}</td>
</tr>`;
      })
      .join("");

    const md = buildDevMd(repro);
    const firstUrl = repro.startUrl || "";

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root { --ink:#1c1410; --paper:#f6f0e6; --line:#e7dcc8; --red:#be123c; --muted:#7c6a58; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.6 "PingFang SC","Microsoft YaHei",Georgia,serif; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    header { border-bottom: 2px solid var(--ink); padding-bottom: 1rem; margin-bottom: 1.25rem; }
    .kicker { letter-spacing: 0.18em; font-size: 0.72rem; color: var(--red); font-weight: 700; }
    h1 { margin: 0.2rem 0 0.4rem; font-size: 1.8rem; }
    .intro { margin: 0; color: var(--muted); }
    .meta { margin: 0.5rem 0 0; font-size: 0.78rem; color: var(--muted); }
    .tabs, .toolbar { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0 1.5rem; }
    button, .toolbar a, .tabs button {
      font: inherit; border-radius: 999px; padding: 0.45rem 0.9rem; cursor: pointer;
      border: 1.5px solid var(--ink); background: var(--ink); color: var(--paper); text-decoration: none;
    }
    button.ghost, .toolbar a.ghost, .tabs button.ghost { background: transparent; color: var(--ink); }
    .card { display: grid; grid-template-columns: 2.4rem 1fr; gap: 0.7rem; margin: 0 0 1.4rem; }
    .num {
      width: 2rem; height: 2rem; border-radius: 50%; border: 1.5px solid var(--ink);
      display: grid; place-items: center; font-weight: 700; font-size: 0.85rem;
    }
    h2 { margin: 0 0 0.25rem; font-size: 1.05rem; }
    .card p { margin: 0 0 0.45rem; }
    .go a { color: var(--red); }
    .shot { position: relative; border: 1px solid var(--line); background: #fff; border-radius: 0.4rem; overflow: hidden; }
    .shot img { display: block; width: 100%; }
    .shot.empty { padding: 1.2rem; color: var(--muted); font-size: 0.9rem; }
    .pin {
      position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
      background: var(--red); box-shadow: 0 0 0 6px rgba(190,18,60,0.28); pointer-events: none;
    }
    .foot { margin-top: 2rem; font-size: 0.78rem; color: var(--muted); border-top: 1px solid var(--line); padding-top: 0.8rem; }
    #view-dev { display: none; }
    body.dev #view-manual { display: none; }
    body.dev #view-dev { display: block; }
    .issue { background: #fff; border: 1px solid var(--line); padding: 0.8rem 1rem; border-radius: 0.4rem; }
    .findings { list-style: none; margin: 0; padding: 0; }
    .findings li { margin: 0 0 0.7rem; padding: 0.65rem 0.75rem; background: #fff; border-left: 3px solid #a8a29e; }
    .findings li span { display: block; color: var(--muted); font-size: 0.92rem; }
    .findings .lv-high { border-color: var(--red); }
    .findings .lv-med { border-color: #c2410c; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: #fff; }
    th, td { border: 1px solid var(--line); padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
    code { font-size: 0.78rem; word-break: break-all; }
    #md { display: none; }
    #stage {
      display: none; position: fixed; inset: 0; background: rgba(28,20,16,0.92); color: #f6f0e6;
      z-index: 9; flex-direction: column; padding: 1rem;
    }
    #stage.on { display: flex; }
    #stage .frame { flex: 1; display: grid; place-items: center; min-height: 0; }
    #stage .pic { position: relative; display: inline-block; max-width: 100%; }
    #stage img { display: block; max-width: 100%; max-height: 70vh; border-radius: 0.4rem; background: #000; }
    #stage .empty { opacity: 0.7; }
    #stage .pin { z-index: 2; }
    #stage .cap { text-align: center; padding: 0.8rem; }
    #stage .cap strong { display: block; font-size: 1.1rem; margin-bottom: 0.2rem; }
    #stage .bar { display: flex; justify-content: center; gap: 0.5rem; padding-bottom: 0.6rem; }
    #stage button { background: #f6f0e6; color: #1c1410; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="kicker">操作手册 · 复现包</p>
      <h1>${esc(title)}</h1>
      <p class="intro">${esc(intro)}</p>
      ${when ? `<p class="meta">录于 ${esc(when)} · 用浏览器打开本文件即可</p>` : `<p class="meta">用浏览器打开本文件即可</p>`}
    </header>
    <div class="tabs">
      <button type="button" id="tab-manual">给同事看</button>
      <button type="button" id="tab-dev" class="ghost">给开发看</button>
    </div>
    <div id="view-manual">
      <div class="toolbar">
        <button type="button" id="play">演示一遍</button>
        <a class="ghost" href="#s0">从第一步看</a>
      </div>
      ${cards.join("\n") || "<p>还没有步骤。</p>"}
    </div>
    <div id="view-dev">
      <h2>测试说的问题</h2>
      <p class="issue">${esc(repro.issue || "（未填写。让测试在录制前写上「出了什么问题」。）")}</p>
      ${firstUrl ? `<p class="go"><a href="${esc(firstUrl)}" target="_blank" rel="noreferrer">打开入口页（线上/测试环境）</a></p>` : ""}
      <h2>可能的问题</h2>
      <ul class="findings">${findingHtml}</ul>
      <h2>步骤与定位</h2>
      <table>
        <thead><tr><th>#</th><th>动作</th><th>选择器</th><th>名称 / 值</th></tr></thead>
        <tbody>${table}</tbody>
      </table>
      <div class="toolbar">
        <button type="button" id="copy-md">复制给开发的说明</button>
      </div>
      <textarea id="md">${esc(md)}</textarea>
    </div>
    <p class="foot">本文件由「步骤记录器」根据真实操作生成。演示只是带着看步骤；给开发看的分析来自选择器与当时的报错，不是替你修 bug。</p>
  </div>
  <script type="application/json" id="skilltap-repro">${jsonForScript(repro)}</script>
  <div id="stage" aria-modal="true">
    <div class="frame">
      <div class="pic">
        <img id="stage-img" alt="" />
        <i class="pin" id="stage-pin"></i>
      </div>
      <p class="empty" id="stage-empty">这一步没有截图</p>
    </div>
    <div class="cap">
      <strong id="stage-title"></strong>
      <span id="stage-body"></span>
    </div>
    <div class="bar">
      <button type="button" id="prev">上一步</button>
      <button type="button" id="pause">暂停</button>
      <button type="button" id="next">下一步</button>
      <button type="button" id="close">退出演示</button>
    </div>
  </div>
  <script>
    const STEPS = ${JSON.stringify(demo)};
    let i = 0, timer = 0, playing = false;
    const stage = document.getElementById("stage");
    const img = document.getElementById("stage-img");
    const empty = document.getElementById("stage-empty");
    const pin = document.getElementById("stage-pin");
    const titleEl = document.getElementById("stage-title");
    const bodyEl = document.getElementById("stage-body");
    const pauseBtn = document.getElementById("pause");
    const tabManual = document.getElementById("tab-manual");
    const tabDev = document.getElementById("tab-dev");

    function setDev(on) {
      document.body.classList.toggle("dev", on);
      tabManual.classList.toggle("ghost", on);
      tabDev.classList.toggle("ghost", !on);
    }
    tabManual.onclick = () => setDev(false);
    tabDev.onclick = () => setDev(true);
    document.getElementById("copy-md").onclick = async () => {
      const text = document.getElementById("md").value;
      try { await navigator.clipboard.writeText(text); } catch {}
    };
    if (location.hash === "#dev") setDev(true);

    function show(n) {
      i = (n + STEPS.length) % STEPS.length;
      const s = STEPS[i];
      titleEl.textContent = (i + 1) + " / " + STEPS.length + "  " + s.title;
      bodyEl.textContent = s.body;
      if (s.shot) {
        img.src = s.shot;
        img.style.display = "block";
        empty.style.display = "none";
      } else {
        img.removeAttribute("src");
        img.style.display = "none";
        empty.style.display = "block";
      }
      if (typeof s.xPct === "number" && typeof s.yPct === "number") {
        pin.style.display = "block";
        pin.style.left = s.xPct + "%";
        pin.style.top = s.yPct + "%";
      } else {
        pin.style.display = "none";
      }
    }
    function stopTimer() { clearInterval(timer); timer = 0; }
    function play() {
      playing = true;
      pauseBtn.textContent = "暂停";
      stopTimer();
      timer = setInterval(() => {
        if (i >= STEPS.length - 1) { pause(); return; }
        show(i + 1);
      }, 2400);
    }
    function pause() {
      playing = false;
      pauseBtn.textContent = "继续";
      stopTimer();
    }
    function openStage() {
      stage.classList.add("on");
      show(0);
      play();
    }
    document.getElementById("play").onclick = openStage;
    document.getElementById("close").onclick = () => { pause(); stage.classList.remove("on"); };
    document.getElementById("next").onclick = () => { pause(); show(i + 1); };
    document.getElementById("prev").onclick = () => { pause(); show(i - 1); };
    pauseBtn.onclick = () => (playing ? pause() : play());
    document.addEventListener("keydown", (e) => {
      if (!stage.classList.contains("on")) return;
      if (e.key === "Escape") { pause(); stage.classList.remove("on"); }
      if (e.key === "ArrowRight") { pause(); show(i + 1); }
      if (e.key === "ArrowLeft") { pause(); show(i - 1); }
    });
  </script>
</body>
</html>
`;
  }

  function buildPack(input) {
    const Clean = getClean();
    const repro = buildRepro(input);
    const html = buildManualHtml({ ...input, repro });
    const md = buildDevMd(repro);
    const json = JSON.stringify(repro, null, 2) + "\n";
    const stem = Clean.packStem ? Clean.packStem(repro.name) : repro.name;
    return {
      filename: `${stem}.html`,
      zipName: `${stem}-复现包.zip`,
      html,
      md,
      json,
      repro,
      files: [
        { name: `${stem}.html`, text: html },
        { name: "给开发.md", text: md },
        { name: "repro.json", text: json },
      ],
    };
  }

  return { buildPack, buildManualHtml, buildDevMd, buildRepro, parseRepro };
});
