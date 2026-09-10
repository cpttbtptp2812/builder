import { useEffect, useState } from "react";
import {
  calcWorkTenure,
  formatTenureExperience,
  formatWorkTenure,
  type WorkTenure,
} from "../lib/workTenure";

type Props = {
  /** ISO 日期，如 2016-06-01 */
  startDate: string;
  /** 外部传入则与简介等共用同一份计算结果 */
  tenure?: WorkTenure;
  /** 默认根据 startDate 动态生成「X 年+ 经验」 */
  startLabel?: string | false;
};

/** 工作年限 — 精确到天，每分钟刷新 */
export function WorkTenureLive({ startDate, tenure: tenureProp, startLabel }: Props) {
  const [internal, setInternal] = useState(() => calcWorkTenure(startDate));

  useEffect(() => {
    if (tenureProp) return;
    const tick = () => setInternal(calcWorkTenure(startDate));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [startDate, tenureProp]);

  const tenure = tenureProp ?? internal;
  const label =
    startLabel === false
      ? null
      : startLabel ?? formatTenureExperience(tenure);

  return (
    <p className="resume-tenure" title={`累计 ${tenure.totalDays.toLocaleString()} 天`}>
      <span className="resume-tenure-live" aria-hidden>
        LIVE
      </span>
      <span>
        工作年限 <strong>{formatWorkTenure(tenure)}</strong>
        <span className="resume-tenure-days">（共 {tenure.totalDays.toLocaleString()} 天</span>
        {label ? <span className="resume-tenure-days"> · {label}</span> : null}
        <span className="resume-tenure-days">）</span>
      </span>
    </p>
  );
}
