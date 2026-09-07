const KEY = "envProfiles";
const SYNC_KEY = "__env_profile__";

function hostFromUrl(url) {
  try {
    return new URL(url, location.href).hostname;
  } catch {
    return location.hostname;
  }
}

function readProfile() {
  try {
    const raw = sessionStorage.getItem(SYNC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

(function () {
  if (window.__envHooked) return;
  window.__envHooked = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = function envFetch(input, init = {}) {
    const profile = readProfile();
    if (!profile?.enabled) return origFetch(input, init);

    let url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));

    if (profile.token) {
      headers.set("Authorization", profile.token.startsWith("Bearer ") ? profile.token : `Bearer ${profile.token}`);
    }
    if (profile.headers) {
      for (const [k, v] of Object.entries(profile.headers)) {
        if (v) headers.set(k, v);
      }
    }

    if (profile.apiBase && url.startsWith("/")) {
      url = profile.apiBase.replace(/\/$/, "") + url;
    } else if (profile.apiBase && profile.rewriteHost) {
      try {
        const u = new URL(url, location.href);
        const base = new URL(profile.apiBase);
        if (u.hostname === location.hostname || u.pathname.startsWith("/api")) {
          u.protocol = base.protocol;
          u.host = base.host;
          url = u.toString();
        }
      } catch { /* keep */ }
    }

    const nextInit = { ...init, headers };
    if (typeof input === "string") return origFetch(url, nextInit);
    if (input instanceof Request) {
      return origFetch(new Request(url, { ...input, headers }), nextInit);
    }
    return origFetch(url, nextInit);
  };
})();

window.addEventListener("__env_profile__", (ev) => {
  try {
    sessionStorage.setItem(SYNC_KEY, JSON.stringify(ev.detail || null));
  } catch { /* ignore */ }
});
