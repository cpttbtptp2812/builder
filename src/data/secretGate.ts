/** 隐藏页解锁状态 — 仅当前浏览器会话 */
export const SECRET_GATE_KEY = "star-gate-unlock";
export const SECRET_PASSWORD = "202812";

export function isSecretUnlocked() {
  try {
    return sessionStorage.getItem(SECRET_GATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockSecret() {
  try {
    sessionStorage.setItem(SECRET_GATE_KEY, "1");
  } catch {
    /* ignore */
  }
}
