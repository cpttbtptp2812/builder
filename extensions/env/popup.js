let currentHost = "";

async function load() {
  const h = await chrome.runtime.sendMessage({ type: "env-get-host" });
  currentHost = h?.host || "";
  document.getElementById("host").textContent = currentHost || "非 http 页面";

  if (!currentHost) return;

  const res = await chrome.runtime.sendMessage({ type: "env-load", host: currentHost });
  const p = res?.profile;
  if (!p) return;

  document.getElementById("enabled").checked = Boolean(p.enabled);
  document.getElementById("apiBase").value = p.apiBase || "";
  document.getElementById("rewriteHost").checked = Boolean(p.rewriteHost);
  document.getElementById("token").value = p.token || "";
  document.getElementById("headers").value = p.headers ? JSON.stringify(p.headers, null, 0) : "";
}

function showMsg(text, err = false) {
  const el = document.getElementById("msg");
  el.textContent = text;
  el.className = err ? "msg err" : "msg";
}

document.getElementById("save").addEventListener("click", async () => {
  if (!currentHost) return showMsg("当前页无法配置", true);

  let headers = {};
  const rawHeaders = document.getElementById("headers").value.trim();
  if (rawHeaders) {
    try {
      headers = JSON.parse(rawHeaders);
    } catch {
      return showMsg("Header JSON 格式错误", true);
    }
  }

  const profile = {
    enabled: document.getElementById("enabled").checked,
    apiBase: document.getElementById("apiBase").value.trim(),
    rewriteHost: document.getElementById("rewriteHost").checked,
    token: document.getElementById("token").value.trim(),
    headers,
  };

  await chrome.runtime.sendMessage({ type: "env-save", host: currentHost, profile });
  showMsg("已保存 — 请刷新目标页面");
});

document.getElementById("enabled").addEventListener("change", () => {
  document.getElementById("save").click();
});

load();
