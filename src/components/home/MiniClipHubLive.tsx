import { useEffect, useState } from "react";

/** ClipHub 卡片预览 — 保存 → 列表 → 跳回 */
export function MiniClipHubLive() {
  const [step, setStep] = useState(0);
  const steps = [
    { label: "选中网页文字", detail: "Git is a free and open source…" },
    { label: "右键保存到 ClipHub", detail: "含页面位置 · 本地存储" },
    { label: "点击列表跳回原处", detail: "文字匹配 + 坐标辅助定位" },
  ];

  useEffect(() => {
    const tick = window.setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 2200);
    return () => clearInterval(tick);
  }, [steps.length]);

  return (
    <div className="mini-live mini-clip-hub" onClick={(e) => e.stopPropagation()}>
      <div className="mini-live-head">
        <span className="live-pulse teaser">CLIP HUB</span>
        <span className="mini-live-label">本地工具</span>
      </div>
      <div className="mini-clip-hub-flow">
        {steps.map((s, i) => (
          <div key={s.label} className={`mini-clip-hub-step${i === step ? " on" : ""}`}>
            <span className="mini-clip-hub-num">{i + 1}</span>
            <div>
              <strong>{s.label}</strong>
              <p>{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
