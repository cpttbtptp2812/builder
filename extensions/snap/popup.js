const KEY = "snapGallery";
const MAX = 12;
let current = null;

async function load() {
  const { [KEY]: items } = await chrome.storage.local.get(KEY);
  return Array.isArray(items) ? items : [];
}

async function save(items) {
  await chrome.storage.local.set({ [KEY]: items.slice(0, MAX) });
}

function renderPreview(dataUrl) {
  current = dataUrl;
  const preview = document.getElementById("preview");
  preview.innerHTML = `<img src="${dataUrl}" alt="截图预览" />`;
  document.getElementById("actions").hidden = false;
}

function renderGrid(items) {
  const grid = document.getElementById("grid");
  if (!items.length) {
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1;text-align:center;color:#64748b;font-size:0.72rem">暂无历史</p>';
    return;
  }
  grid.innerHTML = items.map((url, i) =>
    `<button type="button" data-i="${i}"><img src="${url}" alt="" /></button>`
  ).join("");
  grid.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => renderPreview(items[Number(btn.dataset.i)]));
  });
}

document.getElementById("capture").addEventListener("click", async () => {
  const btn = document.getElementById("capture");
  btn.disabled = true;
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    const items = [dataUrl, ...(await load()).filter((u) => u !== dataUrl)];
    await save(items);
    renderPreview(dataUrl);
    renderGrid(items);
  } catch (err) {
    alert("截图失败：" + (err?.message || "无权限"));
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("copy").addEventListener("click", async () => {
  if (!current) return;
  const res = await fetch(current);
  const blob = await res.blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  document.getElementById("copy").textContent = "已复制 ✓";
  setTimeout(() => { document.getElementById("copy").textContent = "复制图片"; }, 1200);
});

document.getElementById("download").addEventListener("click", () => {
  if (!current) return;
  const a = document.createElement("a");
  a.href = current;
  a.download = `snap-${Date.now()}.png`;
  a.click();
});

document.getElementById("clear").addEventListener("click", async () => {
  await save([]);
  renderGrid([]);
});

load().then((items) => {
  renderGrid(items);
  if (items[0]) renderPreview(items[0]);
});
