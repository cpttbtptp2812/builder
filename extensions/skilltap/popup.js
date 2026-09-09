const nameEl = document.getElementById("name");
const descEl = document.getElementById("desc");
const issueEl = document.getElementById("issue");
const toggleEl = document.getElementById("toggle");
const pauseEl = document.getElementById("pause");
const exportEl = document.getElementById("export");
const exportPackEl = document.getElementById("export-pack");
const previewEl = document.getElementById("preview");
const openUrlEl = document.getElementById("open-url");
const importEl = document.getElementById("import");
const clearEl = document.getElementById("clear");
const listEl = document.getElementById("list");
const findingsEl = document.getElementById("findings");
const countEl = document.getElementById("count");
const msgEl = document.getElementById("msg");
const pillEl = document.getElementById("rec-pill");

let state = null;
let savingMeta = 0;

function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function setMsg(text, err) {
  msgEl.textContent = text || "";
  msgEl.className = err ? "msg err" : "msg";
}

function startUrlOf(next) {
  return next.startUrl || next.steps?.find((s) => s.action === "goto")?.url || next.steps?.find((s) => s.url)?.url || "";
}

function renderFindings(next) {
  const items = SkillTapAnalyze.analyze({
    steps: next.steps || [],
    logs: next.logs || [],
    issue: next.issue || issueEl.value,
  });
  findingsEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "录完或导入后，这里会出现可能的问题。";
    findingsEl.appendChild(li);
    return;
  }
  items.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");
    li.className = `lv-${item.level}`;
    li.textContent = `[${SkillTapAnalyze.levelLabel(item.level)}] ${item.title}：${item.detail}`;
    findingsEl.appendChild(li);
  });
}

function render(next) {
  state = next;
  if (document.activeElement !== nameEl) nameEl.value = next.name || "";
  if (document.activeElement !== descEl) descEl.value = next.description || "";
  if (document.activeElement !== issueEl) issueEl.value = next.issue || "";

  const rec = Boolean(next.recording);
  pillEl.textContent = rec ? "录制中" : "待机";
  pillEl.className = rec ? "pill on" : "pill off";
  toggleEl.textContent = rec ? "停止" : "开始录制";
  toggleEl.classList.toggle("stop", rec);

  const steps = Array.isArray(next.steps) ? next.steps : [];
  const ready = steps.length > 0 && !rec;
  countEl.textContent = `${steps.length} 步`;
  exportEl.disabled = !ready;
  exportPackEl.disabled = !ready;
  previewEl.disabled = !ready;
  openUrlEl.disabled = !startUrlOf(next);

  listEl.innerHTML = "";
  if (!steps.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = rec ? "正在记录点击、填写和报错…" : "还没有步骤。打开出问题的网页再录，或导入复现包。";
    listEl.appendChild(empty);
  } else {
    steps.forEach((step, index) => {
      const li = document.createElement("li");
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = String(index + 1);
      const body = document.createElement("span");
      body.className = step.action === "pause" ? "act-pause" : step.action === "goto" ? "act-goto" : "";
      body.textContent = SkillTapClean.summarize(step);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = "×";
      del.title = "删除这步";
      del.addEventListener("click", async () => {
        const res = await send({ type: "skilltap-remove", index });
        if (res?.state) render(res.state);
      });
      li.append(n, body, del);
      listEl.appendChild(li);
    });
  }

  renderFindings(next);
}

async function persistMeta() {
  clearTimeout(savingMeta);
  savingMeta = window.setTimeout(() => {
    send({
      type: "skilltap-save-meta",
      name: nameEl.value.trim(),
      description: descEl.value.trim(),
      issue: issueEl.value.trim(),
    });
  }, 200);
}

async function currentPack() {
  await send({
    type: "skilltap-save-meta",
    name: nameEl.value.trim(),
    description: descEl.value.trim(),
    issue: issueEl.value.trim(),
  });
  const shotRes = await send({ type: "skilltap-shots" });
  return SkillTapPack.buildPack({
    name: nameEl.value.trim() || "操作手册",
    description: descEl.value.trim(),
    issue: issueEl.value.trim(),
    steps: state.steps,
    logs: state.logs || [],
    shots: shotRes?.shots || {},
    startUrl: startUrlOf(state),
    userAgent: state.userAgent,
    viewport: state.viewport,
    recordedAt: new Date().toISOString(),
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

nameEl.addEventListener("input", persistMeta);
descEl.addEventListener("input", persistMeta);
issueEl.addEventListener("input", persistMeta);

toggleEl.addEventListener("click", async () => {
  setMsg("");
  const type = state?.recording ? "skilltap-stop" : "skilltap-start";
  const res = await send({ type });
  if (!res?.ok) {
    setMsg(res?.error || "操作失败", true);
    return;
  }
  let next = res.state;
  if (type === "skilltap-stop") {
    const cleaned = SkillTapClean.cleanSteps(next.steps || next.rawSteps || []);
    const saved = await send({ type: "skilltap-replace-steps", steps: cleaned });
    next = saved?.state || { ...next, steps: cleaned };
    setMsg(`整理成 ${cleaned.length} 步。同事导出 HTML，开发导出复现包。`);
  }
  render(next);
});

pauseEl.addEventListener("click", async () => {
  const reason = window.prompt("这一步对方要自己做的事", "登录 / 验证码") || "登录 / 验证码";
  const res = await send({ type: "skilltap-pause", reason });
  if (res?.state) render(res.state);
});

clearEl.addEventListener("click", async () => {
  const res = await send({ type: "skilltap-clear" });
  if (res?.state) render(res.state);
  setMsg("");
});

previewEl.addEventListener("click", async () => {
  if (!state?.steps?.length) return;
  await send({
    type: "skilltap-save-meta",
    name: nameEl.value.trim(),
    description: descEl.value.trim(),
    issue: issueEl.value.trim(),
  });
  const res = await send({ type: "skilltap-preview" });
  if (!res?.ok) setMsg("无法打开预览", true);
  else setMsg("已打开。切到「给开发看」可看分析。");
});

openUrlEl.addEventListener("click", async () => {
  const res = await send({ type: "skilltap-open-start" });
  if (!res?.ok) setMsg(res?.error || "没有入口网址", true);
});

exportEl.addEventListener("click", async () => {
  if (!state?.steps?.length) return;
  const pack = await currentPack();
  downloadBlob(new Blob([pack.html], { type: "text/html;charset=utf-8" }), pack.filename);
  setMsg(`已下载「${pack.filename}」。发给同事用浏览器打开。`);
});

exportPackEl.addEventListener("click", async () => {
  if (!state?.steps?.length) return;
  const pack = await currentPack();
  const bytes = SkillTapZip.pack(pack.files);
  downloadBlob(new Blob([bytes], { type: "application/zip" }), pack.zipName);
  setMsg(`已下载「${pack.zipName}」。给开发：导入里面的 repro.json。`);
});

importEl.addEventListener("change", async () => {
  const file = importEl.files && importEl.files[0];
  importEl.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const data = SkillTapPack.parseRepro(text);
    const res = await send({ type: "skilltap-import", data });
    if (!res?.ok) throw new Error("导入失败");
    render(res.state);
    setMsg(`已导入「${res.state.name || file.name}」。可打开入口页或预览手册。`);
  } catch (err) {
    setMsg(err.message || "无法识别这个文件", true);
  }
});

chrome.storage.session.onChanged.addListener((changes, area) => {
  if (area !== "session" || !changes.skilltap) return;
  const next = changes.skilltap.newValue;
  if (next) render(next);
});

send({ type: "skilltap-get" }).then((res) => {
  render(res?.state || { recording: false, steps: [], name: "", description: "", issue: "", logs: [] });
});
