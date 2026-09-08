import { EXTENSION_CATALOG } from "./clipHubExtensions";

export const extensionHub = {
  name: "插件集",
  tagline: "自用 Chrome 扩展，下载解压加载。数据在本地，不联网也能用。",
  ready: true,
};

/** @deprecated use extensionHub */
export const clipHubRelease = {
  name: extensionHub.name,
  version: EXTENSION_CATALOG[0]?.version ?? "1.2.0",
  tagline: extensionHub.tagline,
  ready: extensionHub.ready,
};

export function getExtensionHubUrls() {
  return { catalog: EXTENSION_CATALOG };
}

/** @deprecated */
export function getClipHubDownloadUrls() {
  const ext = EXTENSION_CATALOG[0]!;
  return {
    extensionUrl: `${import.meta.env.BASE_URL}downloads/${ext.zip}`,
  };
}

export { EXTENSION_CATALOG };
