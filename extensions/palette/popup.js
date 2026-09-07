const STORAGE_KEY = "paletteHistory";
const MAX = 24;

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      default: h = ((rn - gn) / d + 4) / 6;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function normalizeHex(raw) {
  let h = String(raw).trim().toLowerCase();
  if (!h.startsWith("#")) h = "#" + h;
  if (h.length === 4) h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  return h;
}

async function loadHistory() {
  const { [STORAGE_KEY]: items } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(items) ? items : [];
}

async function saveHistory(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items.slice(0, MAX) });
}

const swatchEl = document.getElementById("current-swatch");
const hexEl = document.getElementById("current-hex");
const formatsEl = document.getElementById("formats");
const gridEl = document.getElementById("grid");
let current = "#6366f1";

function renderCurrent(hex) {
  current = normalizeHex(hex);
  swatchEl.style.background = current;
  hexEl.textContent = current;
  const { r, g, b } = hexToRgb(current);
  const { h, s, l } = hexToHsl(current);
  const formats = [
    { label: "HEX", value: current },
    { label: "RGB", value: `rgb(${r}, ${g}, ${b})` },
    { label: "HSL", value: `hsl(${h}, ${s}%, ${l}%)` },
  ];
  formatsEl.innerHTML = formats.map((f) =>
    `<button type="button" class="fmt" data-copy="${f.value.replace(/"/g, "&quot;")}"><em>${f.label}</em><span>${f.value}</span></button>`
  ).join("");
  formatsEl.querySelectorAll(".fmt").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 900);
    });
  });
}

function renderGrid(items) {
  if (!items.length) {
    gridEl.innerHTML = '<p class="empty">取色后会出现在这里</p>';
    return;
  }
  gridEl.innerHTML = items.map((hex) =>
    `<button type="button" style="background:${hex}" title="${hex}" data-hex="${hex}"></button>`
  ).join("");
  gridEl.querySelectorAll("button[data-hex]").forEach((btn) => {
    btn.addEventListener("click", () => renderCurrent(btn.dataset.hex));
  });
}

async function addColor(hex) {
  const h = normalizeHex(hex);
  const items = [h, ...(await loadHistory()).filter((x) => x !== h)];
  await saveHistory(items);
  renderCurrent(h);
  renderGrid(items);
}

document.getElementById("pick").addEventListener("click", async () => {
  const btn = document.getElementById("pick");
  btn.disabled = true;
  btn.textContent = "点击屏幕任意位置…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("无活动标签页");
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        if (!window.EyeDropper) return { error: "当前浏览器不支持 EyeDropper API" };
        const dropper = new EyeDropper();
        const { sRGBHex } = await dropper.open();
        return { hex: sRGBHex };
      },
    });
    if (result?.error) throw new Error(result.error);
    if (result?.hex) await addColor(result.hex);
  } catch (err) {
    if (err?.message?.includes("Abort") || err?.name === "AbortError") return;
    alert(err?.message || "取色失败");
  } finally {
    btn.disabled = false;
    btn.textContent = "从屏幕取色";
  }
});

document.getElementById("clear").addEventListener("click", async () => {
  await saveHistory([]);
  renderGrid([]);
});

loadHistory().then((items) => {
  renderCurrent(items[0] || current);
  renderGrid(items);
});
