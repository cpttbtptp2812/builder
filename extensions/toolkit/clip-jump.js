/** 构建跳转 URL：有文字时由 content script 定位，无文字时用坐标 hash */
export function buildJumpUrl(item) {
  if (!item?.pageUrl) return null;
  const base = String(item.pageUrl).split("#")[0];
  if (item.content?.trim()) return base;
  const y = item.scrollY ?? item.anchorY;
  if (y != null && !Number.isNaN(Number(y))) {
    return `${base}#clip-hub-y=${Math.round(Number(y))}`;
  }
  if (item.textFragment) return base + item.textFragment;
  return base;
}
