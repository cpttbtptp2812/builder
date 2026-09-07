const CHANNEL = "__env_profile__";

async function pushProfile(host) {
  const { envProfiles = {} } = await chrome.storage.local.get("envProfiles");
  const profile = envProfiles[host] || null;
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: profile?.enabled ? profile : null }));
}

pushProfile(location.hostname);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.envProfiles) pushProfile(location.hostname);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "env-push") pushProfile(location.hostname);
});
