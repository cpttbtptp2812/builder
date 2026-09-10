import { FRONTEND_DEBUG_TOOLKIT } from "./clipHubExtensions";

export const extensionHub = {
  name: FRONTEND_DEBUG_TOOLKIT.name,
  tagline: FRONTEND_DEBUG_TOOLKIT.tagline,
  ready: true,
};

/** @deprecated use extensionHub */
export const clipHubRelease = {
  name: extensionHub.name,
  version: FRONTEND_DEBUG_TOOLKIT.version,
  tagline: extensionHub.tagline,
  ready: extensionHub.ready,
};

export function getExtensionHubUrls() {
  return { toolkit: FRONTEND_DEBUG_TOOLKIT };
}

/** @deprecated */
export function getClipHubDownloadUrls() {
  return {
    extensionUrl: `${import.meta.env.BASE_URL}downloads/${FRONTEND_DEBUG_TOOLKIT.zip}`,
  };
}
