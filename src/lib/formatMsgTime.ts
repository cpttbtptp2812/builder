function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 消息时间 — 对齐 tianyangAgent formatMessageTime */
export function formatMsgTime(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = startOfDay(d) === startOfDay(now);
  if (sameDay) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = startOfDay(now) - 86400000;
  if (startOfDay(d) === yesterday) {
    return `昨天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMsgTimeFull(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** 线程日期分割条（今天 / 昨天 / 3月10日 周六） */
export function formatThreadDateLabel(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const day = startOfDay(d);
  const today = startOfDay(now);
  const weekday = d.toLocaleDateString("zh-CN", { weekday: "short" });
  const md = d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  if (day === today) return `今天 · ${md} ${weekday}`;
  if (day === today - 86400000) return `昨天 · ${md} ${weekday}`;
  if (d.getFullYear() === now.getFullYear()) return `${md} ${weekday}`;
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export function isSameMsgDay(a?: number, b?: number): boolean {
  if (!a || !b) return false;
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}
