import React, { useState } from "react";
import {
  Tag,
  Space,
  Modal,
  Input,
  Popconfirm,
  Typography,
  message,
  Switch,
  Row,
  Col,
  Select,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  RobotOutlined,
  SaveOutlined,
  ThunderboltFilled,
  CodeOutlined,
} from "@ant-design/icons";
import StudioButton from "../../../components/common/studio/StudioButton";
import StudioBreadcrumb from "../../../components/common/studio/StudioBreadcrumb";

const { TextArea } = Input;

export interface AgentSkillItem {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  description: string;
  triggerType?: "auto" | "keyword" | "mandatory";
  keywords?: string[];
  systemInstruction?: string;
  severity?: "block" | "warning" | "info";
  requireFixCode?: boolean;
}

interface Step3SkillsProps {
  skills: AgentSkillItem[];
  setSkills: React.Dispatch<React.SetStateAction<AgentSkillItem[]>>;
}

export const Step3Skills: React.FC<Step3SkillsProps> = ({ skills, setSkills }) => {
  const [subView, setSubView] = useState<"list" | "edit">("list");
  const [activeSkill, setActiveSkill] = useState<AgentSkillItem | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleOpenCreate = () => {
    const newSkill: AgentSkillItem = {
      id: `skill-${Date.now()}`,
      name: "新建专项排查规则",
      category: "系统稳定性",
      enabled: true,
      description: "在代码审查中重点定位潜在逻辑隐患，并给出可直接合入的修复代码...",
      triggerType: "auto",
      keywords: ["规范", "代码质量"],
      systemInstruction: `<role>
你是一位资深代码质量专家，针对目标改动执行专业排查。
</role>

<review_guidelines>
1. 深入分析潜在逻辑隐患与边界情况；
2. 指出问题时给出具体行号与调用链路；
3. 输出符合生产规范的标准修复代码补丁。
</review_guidelines>`,
      severity: "block",
      requireFixCode: true,
    };
    setActiveSkill(newSkill);
    setSubView("edit");
  };

  const handleOpenEdit = (skill: AgentSkillItem) => {
    setActiveSkill(JSON.parse(JSON.stringify(skill)));
    setSubView("edit");
  };

  const handleSave = () => {
    if (!activeSkill) return;
    if (!activeSkill.name.trim()) {
      message.warning("请输入排查规则名称");
      return;
    }
    setSkills((prev) => {
      const exists = prev.some((s) => s.id === activeSkill.id);
      return exists
        ? prev.map((s) => (s.id === activeSkill.id ? activeSkill : s))
        : [activeSkill, ...prev];
    });
    message.success(`已保存排查规则「${activeSkill.name}」`);
    setSubView("list");
  };

  const handleDelete = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
    message.info("已移除该排查规则");
  };

  const handleToggle = (id: string, checked: boolean) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: checked } : s))
    );
  };

  // =========================================================================
  // 视图 2：专项排查规则编辑工作台 (极简无边框面包屑 + 超大暗色守则编辑舱)
  // =========================================================================
  if (subView === "edit" && activeSkill) {
    const lineCount = (activeSkill.systemInstruction || "").split("\n").length;
    const charCount = (activeSkill.systemInstruction || "").length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 顶部极简面包屑导航条 (无多余方块线框，右侧单个保存按钮，杜绝取消冗余) */}
        <StudioBreadcrumb
          onBack={() => setSubView("list")}
          backLabel="专项排查"
          currentTitle={activeSkill.name || "新建排查规则"}
          badge={
            <Tag color="blue" style={{ borderRadius: 4, margin: 0 }}>
              {activeSkill.category}
            </Tag>
          }
          rightActions={
            <StudioButton
              variant="primary"
              size="sm"
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              保存规则配置
            </StudioButton>
          }
        />

        {/* 核心双栏画幅：左侧 10 列属性，右侧 14 列超大几百行守则舱 */}
        <Row gutter={[16, 16]}>
          {/* 左侧：属性与生效策略 (10 列) */}
          <Col xs={24} lg={10}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 卡片 1: 基础属性与防护目标 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <SafetyCertificateOutlined style={{ color: "#4f46e5" }} />
                  <span>1. 基础属性与防护目标</span>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                    规则名称
                  </div>
                  <Input
                    value={activeSkill.name}
                    onChange={(e) => setActiveSkill({ ...activeSkill, name: e.target.value })}
                    placeholder="例如：运行时防崩溃排查 (空指针与异常)"
                    style={{ height: 36, borderRadius: 7, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                    业务分类
                  </div>
                  <Select
                    value={activeSkill.category}
                    onChange={(val) => setActiveSkill({ ...activeSkill, category: val })}
                    style={{ width: "100%", height: 36 }}
                    options={[
                      { label: "系统稳定性", value: "系统稳定性" },
                      { label: "安全合规", value: "安全合规" },
                      { label: "前后端协同", value: "前后端协同" },
                      { label: "质量把控", value: "质量把控" },
                      { label: "效率工具", value: "效率工具" },
                      { label: "架构规范", value: "架构规范" },
                    ]}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                    业务场景与价值定位
                  </div>
                  <TextArea
                    value={activeSkill.description}
                    onChange={(e) => setActiveSkill({ ...activeSkill, description: e.target.value })}
                    rows={2}
                    placeholder="说明该规则在什么场景下发挥作用..."
                    style={{ borderRadius: 7, fontSize: 12 }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    缺陷风险阻断级别
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {[
                      { key: "block", label: "🔴 P0 致命", desc: "禁止合并", color: "#ef4444", bg: "#fef2f2" },
                      { key: "warning", label: "🟠 P1 严重", desc: "强烈建议修", color: "#f59e0b", bg: "#fffbeb" },
                      { key: "info", label: "🟡 P2 建议", desc: "代码优化", color: "#3b82f6", bg: "#eff6ff" },
                    ].map((opt) => {
                      const isSel = (activeSkill.severity || "block") === opt.key;
                      return (
                        <div
                          key={opt.key}
                          onClick={() => setActiveSkill({ ...activeSkill, severity: opt.key as any })}
                          style={{
                            padding: "7px 8px",
                            borderRadius: 7,
                            cursor: "pointer",
                            background: isSel ? opt.bg : "#f8fafc",
                            border: `1.5px solid ${isSel ? opt.color : "#e2e8f0"}`,
                            transition: "all 0.15s ease",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: isSel ? opt.color : "#334155" }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{opt.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 卡片 2: 触发规则与生效时机 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <ThunderboltFilled style={{ color: "#d97706" }} />
                  <span>2. 触发策略与生效时机</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { key: "auto", label: "⚡ 智能自适应识别 (推荐)", desc: "根据改动代码上下文语义自动激活" },
                    { key: "mandatory", label: "🛡️ 每次提交全量必检", desc: "每次代码评审 100% 执行此规则" },
                    { key: "keyword", label: "🎯 匹配指定关键词触发", desc: "改动包含特定关键词或文件路径时触发" },
                  ].map((mode) => {
                    const isSel = (activeSkill.triggerType || "auto") === mode.key;
                    return (
                      <div
                        key={mode.key}
                        onClick={() => setActiveSkill({ ...activeSkill, triggerType: mode.key as any })}
                        style={{
                          padding: "8px 11px",
                          borderRadius: 7,
                          cursor: "pointer",
                          background: isSel ? "#eef2ff" : "#f8fafc",
                          border: `1.5px solid ${isSel ? "#6366f1" : "#e2e8f0"}`,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: isSel ? "#4f46e5" : "#334155" }}>
                          {mode.label}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 1 }}>{mode.desc}</div>
                      </div>
                    );
                  })}
                </div>

                {activeSkill.triggerType === "keyword" && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
                      关联触发词 (以英文逗号分隔)
                    </div>
                    <Input
                      value={activeSkill.keywords?.join(", ")}
                      onChange={(e) =>
                        setActiveSkill({
                          ...activeSkill,
                          keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      placeholder="如：null, 崩溃, 异常, 空指针"
                      style={{ height: 34, borderRadius: 6, fontSize: 12 }}
                    />
                  </div>
                )}
              </div>

              {/* 卡片 3: 执行策略 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: "#0f172a" }}>
                    自动输出标准修复补丁 (Fix Patch)
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    指出问题时直接附带可合入的改好代码，免除人工反复重写。
                  </div>
                </div>
                <Switch
                  checked={activeSkill.requireFixCode !== false}
                  onChange={(checked) => setActiveSkill({ ...activeSkill, requireFixCode: checked })}
                />
              </div>
            </div>
          </Col>

          {/* 右侧：几百行超大暗色审查守则舱 (14 列) */}
          <Col xs={24} lg={14}>
            <div
              style={{
                background: "#ffffff",
                borderRadius: 12,
                border: "1.5px solid #cbd5e1",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                height: "100%",
                minHeight: 560,
              }}
            >
              {/* 头部标题与统计指标 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: "#ecfdf5",
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                    }}
                  >
                    <RobotOutlined />
                  </div>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>
                    审查守则与执行约束
                  </span>
                  <Tag color="cyan" style={{ margin: 0, borderRadius: 4, fontSize: 10.5, padding: "1px 6px" }}>
                    大模型底层指令
                  </Tag>
                </div>

                <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>
                  当前：{lineCount} 行 · {charCount} 字符
                </div>
              </div>

              {/* 快捷规范模板芯片 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 6,
                  padding: "7px 10px",
                  background: "#f8fafc",
                  borderRadius: 7,
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>快捷模板:</span>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {[
                    {
                      label: "+ 判空防崩",
                      text: "\n<rule name=\"null_safety\">\n重点排查所有多级对象引用与链式调用，未做非空防御（如 Optional 或空值判空校验）必须指出具体代码行号与潜在调用链路。\n</rule>",
                    },
                    {
                      label: "+ 资源释放",
                      text: "\n<rule name=\"resource_leak\">\n排查数据库连接、IO 流、并发线程池等系统资源是否在 finally 或 try-with-resources 中安全关闭，杜绝泄漏隐患。\n</rule>",
                    },
                    {
                      label: "+ 接口向后兼容",
                      text: "\n<rule name=\"api_contract\">\n检查对外暴露的 API 契约，严禁随意删除已有字段或修改字段数据类型，防止调用方发生反序列化崩溃。\n</rule>",
                    },
                    {
                      label: "+ 敏感凭证防泄",
                      text: "\n<rule name=\"security_redline\">\n严格扫描硬编码的数据库密码、云厂商 AccessKey/SecretKey、私钥证书与字符串拼接 SQL，命中即判定为 P0 阻断隐患。\n</rule>",
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() =>
                        setActiveSkill({
                          ...activeSkill,
                          systemInstruction: (activeSkill.systemInstruction || "") + item.text,
                        })
                      }
                      style={{
                        fontSize: 10.5,
                        padding: "2px 7px",
                        borderRadius: 5,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        color: "#334155",
                        cursor: "pointer",
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#6366f1";
                        e.currentTarget.style.color = "#4f46e5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#cbd5e1";
                        e.currentTarget.style.color = "#334155";
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 几百行沉浸式暗色代码文本域 */}
              <div style={{ flex: 1, minHeight: 420, display: "flex", flexDirection: "column" }}>
                <TextArea
                  value={activeSkill.systemInstruction}
                  onChange={(e) => setActiveSkill({ ...activeSkill, systemInstruction: e.target.value })}
                  placeholder={`在此编写详细的企业级审查守则与大模型约束（支持几十行至几百行指令）...\n\n<role>\n你是一位资深代码审查专家...\n</role>\n\n<review_guidelines>\n1. 针对所有层级对象引用做空指针排查；\n2. 发现隐患时输出规范修复补丁。\n</review_guidelines>`}
                  style={{
                    flex: 1,
                    minHeight: 420,
                    borderRadius: 8,
                    fontSize: 12.5,
                    lineHeight: 1.7,
                    background: "#0f172a",
                    color: "#f8fafc",
                    border: "1.5px solid #334155",
                    fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, Monaco, monospace",
                    padding: "14px 16px",
                    caretColor: "#818cf8",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748b" }}>
                <span>💡 提示：智能体会将此处守则完整注入到评审上下文，支持使用 Markdown 列表或 XML 标签进行清晰分段。</span>
                <span>支持长指令顺滑滚动</span>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    );
  }

  // =========================================================================
  // 视图 1：专项排查规则列表总览 (无多余双加号，质感卡片)
  // =========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 头部控制栏 (使用质感按钮，彻底告别原生 AntD 默认边框) */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#ecfdf5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            <SafetyCertificateOutlined />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              代码审查专项排查规则
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              在执行代码体检时，智能体会严格遵从以下规则深入扫描代码中的崩溃隐患、安全漏洞与接口断裂
            </div>
          </div>
        </div>

        <StudioButton
          variant="primary"
          size="sm"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
        >
          新建排查规则
        </StudioButton>
      </div>

      {/* 规则卡片网格与空状态 */}
      {skills.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1.5px dashed #cbd5e1",
            padding: "48px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SafetyCertificateOutlined style={{ fontSize: 24, color: "#94a3b8" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
              暂无专项排查规则
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4, maxWidth: 460 }}>
              专项排查能让大模型严格按照几百行专业标准排查空指针、内存泄露或 SQL 注入。点击下方按钮添加属于你的专项规则。
            </div>
          </div>
          <StudioButton
            variant="primary"
            size="md"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
          >
            新建排查规则
          </StudioButton>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 12,
          }}
        >
          {skills.map((skill) => {
            return (
              <div
                key={skill.id}
                style={{
                  background: skill.enabled ? "#ffffff" : "#f8fafc",
                  border: `1.5px solid ${skill.enabled ? "#c7d2fe" : "#e2e8f0"}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 10,
                  boxShadow: skill.enabled ? "0 2px 8px rgba(99, 102, 241, 0.06)" : "none",
                  transition: "all 0.18s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                      <Tag
                        style={{
                          margin: 0,
                          borderRadius: 4,
                          fontSize: 10.5,
                          background: skill.enabled ? "#eef2ff" : "#f1f5f9",
                          color: skill.enabled ? "#4f46e5" : "#64748b",
                          border: skill.enabled ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
                          padding: "1px 6px",
                          flexShrink: 0,
                        }}
                      >
                        {skill.category}
                      </Tag>
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: skill.enabled ? "#0f172a" : "#94a3b8",
                          lineHeight: 1.3,
                        }}
                      >
                        {skill.name}
                      </span>
                    </div>

                    <Switch
                      checked={skill.enabled}
                      onChange={(checked) => handleToggle(skill.id, checked)}
                      size="small"
                    />
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: skill.enabled ? "#475569" : "#94a3b8",
                      lineHeight: 1.5,
                    }}
                  >
                    {skill.description}
                  </div>
                </div>

                {/* 卡片底栏操作 */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 8,
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <StudioButton
                    variant="glass"
                    size="xs"
                    icon={<SettingOutlined />}
                    onClick={() => handleOpenEdit(skill)}
                  >
                    配置守则指令
                  </StudioButton>

                  <Popconfirm
                    title="确定移除该排查规则？"
                    onConfirm={() => handleDelete(skill.id)}
                    okText="移除"
                    cancelText="取消"
                  >
                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        fontSize: 11.5,
                        cursor: "pointer",
                        padding: "2px 6px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                    >
                      <DeleteOutlined /> 移除
                    </button>
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Step3Skills;

