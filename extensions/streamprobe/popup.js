const manifest = chrome.runtime.getManifest();

document.getElementById("version").textContent = `v${manifest.version}`;

function hostLabel(url) {
  try {
    return new URL(url).hostname || "当前页";
  } catch {
    return "当前页";
  }
}

function isSearchPage(url) {
  return /google\.|baidu\.|bing\./i.test(url || "");
}

async function load() {
  const res = await chrome.runtime.sendMessage({ type: "sp-get" });
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  const hint = document.getElementById("hint");

  if (!res?.ok) {
    text.textContent = "无法读取状态";
    return;
  }

  const { connections = [], frames = [] } = res.session || {};
  const msgFrames = frames.filter((f) => f.phase === "message").length;
  const host = hostLabel(res.tabUrl);

  if (msgFrames > 0) {
    dot.className = "status-dot ok";
    text.textContent = `${host} · 已捕获 ${msgFrames} 帧`;
    hint.textContent = "Side Panel 可看 Raw / Parsed。去 AI 页发消息可持续捕获。";
  } else if (isSearchPage(res.tabUrl)) {
    dot.className = "status-dot warn";
    text.textContent = `${host} · 无流式数据（正常）`;
    hint.textContent = "搜索页没有 AI 流。请先点「一键自检」确认扩展能用。";
  } else {
    dot.className = "status-dot idle";
    text.textContent = `${host} · 尚无数据`;
    hint.textContent = "刷新 AI 页后发一条消息，或点「一键自检」。";
  }
}

document.getElementById("self-test").addEventListener("click", async () => {
  const btn = document.getElementById("self-test");
  btn.disabled = true;
  btn.textContent = "注入中…";
  const res = await chrome.runtime.sendMessage({ type: "sp-inject-test" });
  btn.disabled = false;
  btn.textContent = "▶ 一键自检（任意页面可点）";
  if (res?.ok) {
    btn.textContent = `✓ 已注入 ${res.frameCount} 帧 — 看 Side Panel`;
    setTimeout(() => {
      btn.textContent = "▶ 一键自检（任意页面可点）";
    }, 2500);
  }
  load();
});

document.getElementById("open-panel").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "sp-open-panel" });
  window.close();
});

document.getElementById("open-demo").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "sp-open-demo" });
  window.close();
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "sp-clear" });
  load();
});

load();
