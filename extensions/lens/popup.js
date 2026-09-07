async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showMsg(text, err = false) {
  const el = document.getElementById("msg");
  el.textContent = text;
  el.className = err ? "msg err" : "msg";
}

document.getElementById("format-page").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "lens-format-page" });
    if (!res?.ok) showMsg(res?.error || "失败", true);
    else window.close();
  } catch {
    showMsg("请刷新页面后重试", true);
  }
});

document.getElementById("format-selection").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "lens-format-selection" });
    if (!res?.ok) showMsg(res?.error || "请先选中 JSON 文本", true);
    else window.close();
  } catch {
    showMsg("请刷新页面后重试", true);
  }
});

document.getElementById("format-paste").addEventListener("click", async () => {
  const raw = document.getElementById("input").value.trim();
  if (!raw) return showMsg("请粘贴 JSON", true);
  try {
    const data = JSON.parse(raw);
    const pretty = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(pretty);
    document.getElementById("input").value = pretty;
    showMsg("已格式化并复制到剪贴板");
  } catch {
    showMsg("JSON 语法错误", true);
  }
});
