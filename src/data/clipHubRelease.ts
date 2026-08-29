/**
 * ClipHub 公开发布配置 — 仅浏览器插件 zip，不含源码
 * zip 放在 public/downloads/，随网站一起部署
 */
export const clipHubRelease = {
  name: "ClipHub",
  version: "1.1.4",
  tagline: "右键保存网页位置 · 点击跳回原处",
  ready: true,
};

export function getClipHubDownloadUrls() {
  const { version } = clipHubRelease;
  const base = import.meta.env.BASE_URL;

  return {
    extensionUrl: `${base}downloads/ClipHub-Extension-v${version}.zip`,
  };
}
