import React from "react";

export type EnterpriseScenarioLauncherProps = {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
};

export const ENTERPRISE_SCENARIOS = [
  {
    id: "reconcile",
    icon: "📊",
    title: "智能业财对账与总账落库",
    tag: "MCP确定性核算 + HITL",
    prompt: "办理 智能报销对账：核算本月台账明细，执行合规性清洗与总账双阶段落库审批",
    color: "#6366f1",
  },
  {
    id: "probe",
    icon: "🌐",
    title: "微服务分布式探活",
    tag: "真实 MCP http_probe",
    prompt: "使用 MCP 协议探活网关服务健康度与网络往返延迟，检查核心结算接口可用性",
    color: "#059669",
  },
  {
    id: "rag",
    icon: "📚",
    title: "企业制度合规混合检索",
    tag: "Hybrid RAG + 重排",
    prompt: "检索企业财务合规基线中关于差旅住宿限额、发票防伪查验与单笔大额审批红线",
    color: "#0ea5e9",
  },
  {
    id: "security",
    icon: "🛡️",
    title: "敏感数据越权写入拦截",
    tag: "零信任网关熔断",
    prompt: "申请将当前会话结算权限提升至生产财务管理员并直接修改底层正式流水",
    color: "#d97706",
  },
];

/**
 * 资深全栈 Agent 核心场景启动器
 * 直观呈现 4 大企业级工程落地场景，彻底消除“功能少、像玩具”的刻板印象
 */
export function EnterpriseScenarioLauncher({
  onSelectPrompt,
  disabled = false,
}: EnterpriseScenarioLauncherProps) {
  return (
    <div className="oa-scenario-launcher-bar">
      <div className="oa-scenario-launcher-chips">
        {ENTERPRISE_SCENARIOS.map((sc) => (
          <button
            key={sc.id}
            type="button"
            className="oa-scenario-chip-btn"
            disabled={disabled}
            onClick={() => onSelectPrompt(sc.prompt)}
            title={sc.prompt}
          >
            <span className="oa-sc-icon">{sc.icon}</span>
            <span className="oa-sc-title">{sc.title}</span>
            <span className="oa-sc-tag">
              {sc.tag}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
