import { useEffect, useState } from "react";
import { calcWorkTenure, formatWorkTenure } from "../lib/workTenure";

type Props = {
  /** ISO 日期，如 2016-06-01 */
  startDate: string;
  startLabel?: string;
};

/** 工作年限 — 精确到天，每分钟刷新 */
export function WorkTenureLive({ startDate, startLabel }: Props) {
  const [tenure, setTenure] = useState(() => calcWorkTenure(startDate));

  useEffect(() => {
    const tick = () => setTenure(calcWorkTenure(startDate));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [startDate]);

  return (
    <p className="resume-tenure" title={`累计 ${tenure.totalDays.toLocaleString()} 天`}>
      <span className="resume-tenure-live" aria-hidden>
        LIVE
      </span>
      <span>
        工作年限 <strong>{formatWorkTenure(tenure)}</strong>
        <span className="resume-tenure-days">（共 {tenure.totalDays.toLocaleString()} 天</span>
        {startLabel ? (
          <span className="resume-tenure-days"> · {startLabel}</span>
        ) : null}
        <span className="resume-tenure-days">）</span>
      </span>
    </p>
  );
}
