import { useEffect, useState } from "react";

export type WorkTenure = {
  years: number;
  months: number;
  days: number;
  totalDays: number;
};

/** 自入职日起算 — 年月日 + 累计天数 */
export function calcWorkTenure(startISO: string, now = new Date()): WorkTenure {
  const [y, m, d] = startISO.split("-").map(Number);
  const start = new Date(y!, m! - 1, d!);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const totalDays = Math.max(
    0,
    Math.floor((today.getTime() - start.getTime()) / 86_400_000),
  );

  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  let days = today.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days, totalDays };
}

export function formatWorkTenure(t: WorkTenure): string {
  return `${t.years} 年 ${t.months} 月 ${t.days} 天`;
}

/** 与 WorkTenureLive 展示一致 — 供简介等引用 */
export function formatTenureExperience(t: WorkTenure): string {
  return `${t.years} 年+ 经验`;
}

/** 工作年限 — 每分钟刷新，与 WorkTenureLive 同源 */
export function useWorkTenure(startISO: string) {
  const [tenure, setTenure] = useState(() => calcWorkTenure(startISO));

  useEffect(() => {
    const tick = () => setTenure(calcWorkTenure(startISO));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [startISO]);

  return tenure;
}
