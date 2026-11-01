import React, { useState, useRef, useEffect } from "react";
import { Button, Space, Typography, message, Popconfirm, Tag, Tooltip } from "antd";
import TipTapRichEditor, { TipTapRichEditorRef } from "../../../components/common/TipTapRichEditor";
import StudioButton from "../../../components/common/studio/StudioButton";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SaveOutlined,
  CopyOutlined,
  CheckOutlined,
  ThunderboltFilled,
  CodeOutlined,
  BranchesOutlined,
  SlidersOutlined,
} from "@ant-design/icons";
import { GitRepositoryConfig, PromptSuggestionItem } from "../../../types/platform";

const { Text } = Typography;

export interface PromptChannel {
  id: string;
  title: string;
  content: string;
  isFixed?: boolean;
}

// 提示词数据模型（支持多通道动态规则与横向滚动）
export interface PromptItem {
  id: string;
  name: string; // 提示词名称
  desc: string; // 通俗简要说明
  systemPrompt: string; // 通道 1：核心业务底线准则 (System Prompt)
  userPromptTemplate?: string; // 通道 2：代码与任务装配模板 (User Prompt / Task Template)
  channels?: PromptChannel[]; // 动态多规则通道 (支持 1, 2, 3, 4... + 号添加与水平滚动)
  greeting?: string; // 进场问候语
  isPreset?: boolean; // 官方预设标识
}

interface Step2PromptProps {
  workflowId?: string;
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
  greetingMessage: string;
  setGreetingMessage: (val: string) => void;
  responseStyle: "strict" | "mentor" | "concise";
  setResponseStyle: (val: "strict" | "mentor" | "concise") => void;
  suggestions?: PromptSuggestionItem[];
  setSuggestions?: React.Dispatch<React.SetStateAction<PromptSuggestionItem[]>>;
  gitRepos?: GitRepositoryConfig[];
  prompts: PromptItem[];
  setPrompts: React.Dispatch<React.SetStateAction<PromptItem[]>>;
  onSaveAll?: (overridePrompts?: PromptItem[], applySysPrompt?: string) => Promise<any>;
  onNextStep?: () => void;
  onPrevStep?: () => void;
}

export const Step2Prompt: React.FC<Step2PromptProps> = ({
  systemPrompt,
  setSystemPrompt,
  greetingMessage,
  setGreetingMessage,
  gitRepos = [],
  prompts,
  setPrompts,
  onSaveAll,
  onNextStep,
  onPrevStep,
}) => {
  // null = 列表页面；非 null = 编辑提示词页面
  const [editingItem, setEditingItem] = useState<PromptItem | null>(null);

  // 动态多通道列表 (支持 Tab 1, 2, 3, 4... + 号添加与水平滚动)
  const [channels, setChannels] = useState<PromptChannel[]>([
    { id: "ch-1", title: "1. AI 专家角色与审查守则", content: "", isFixed: true },
    { id: "ch-2", title: "2. 发给 AI 的提问句式", content: "" },
  ]);
  const [activeChannelId, setActiveChannelId] = useState<string>("ch-1");

  // 双击重命名通道模式
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingChannelTitle, setEditingChannelTitle] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingChannelId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingChannelId]);

  const handleStartRename = (ch: PromptChannel) => {
    setEditingChannelId(ch.id);
    setEditingChannelTitle(ch.title);
    setActiveChannelId(ch.id);
  };

  const handleCommitRename = (chId: string) => {
    const trimmed = editingChannelTitle.trim();
    if (trimmed) {
      setChannels((prev) =>
        prev.map((c) => (c.id === chId ? { ...c, title: trimmed } : c))
      );
    }
    setEditingChannelId(null);
  };

  // 编辑态表单值
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editGreeting, setEditGreeting] = useState("");

  const editorRef = useRef<TipTapRichEditorRef>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];

  const handleContentChange = (newVal: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === activeChannelId ? { ...c, content: newVal } : c))
    );
  };

  const handleAddChannel = () => {
    const nextIdx = channels.length + 1;
    const newId = `ch-${Date.now()}`;
    const newCh: PromptChannel = {
      id: newId,
      title: `${nextIdx}. 规则通道 ${nextIdx}`,
      content: `## 规则 ${nextIdx}\n在此编写该场景针对 AI 的补充审查准则、输入前缀或输出约束格式...`,
    };
    setChannels((prev) => [...prev, newCh]);
    setActiveChannelId(newId);
    message.success(`已添加通道「${newCh.title}」`);
  };

  const handleDeleteChannel = (chId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (channels.length <= 1) {
      message.warning("至少保留一个规则通道");
      return;
    }
    const next = channels.filter((c) => c.id !== chId);
    setChannels(next);
    if (activeChannelId === chId) {
      setActiveChannelId(next[0].id);
    }
    message.info("已移除该通道");
  };

  const updateList = (updater: (prev: PromptItem[]) => PromptItem[]) => {
    setPrompts((prev) => updater(prev));
  };

  // 检查是否是当前正在使用的提示词 (以当前 systemPrompt 内容为唯一判断依据)
  const isPromptActive = (p: PromptItem) => {
    return p.systemPrompt.trim() !== "" && p.systemPrompt.trim() === systemPrompt.trim();
  };

  // 选用当前提示词
  const handleApply = (p: PromptItem) => {
    setSystemPrompt(p.systemPrompt);
    if (p.greeting) setGreetingMessage(p.greeting);
    message.success({
      content: `已选用「${p.name}」作为当前生效提示词`,
      icon: <CheckCircleFilled style={{ color: "#10b981" }} />,
    });
  };

  // 点开编辑
  const handleOpenEdit = (p: PromptItem) => {
    setEditingItem(p);
    setEditName(p.name);
    setEditDesc(p.desc);
    const initChannels: PromptChannel[] = (p.channels && p.channels.length > 0)
      ? p.channels
      : [
          { id: "ch-1", title: "1. AI 专家角色与审查守则", content: p.systemPrompt, isFixed: true },
          {
            id: "ch-2",
            title: "2. 发给 AI 的提问句式",
            content:
              p.userPromptTemplate ||
              `针对代码库 {{repo_name}} 的 {{branch}} 分支（版本 #{{latest_commit}}），请审查以下改动：\n\n{{code_diff}}`,
          },
        ];
    setChannels(initChannels);
    setActiveChannelId(initChannels[0].id);
    setEditGreeting(p.greeting || "");
  };

  // 点开新建
  const handleOpenCreate = () => {
    const defaultSys = `<role>\n你是一位针对代码库 {{repo_name}} 的专业审查专家。你的任务是严格审查代码改动并提供清晰的改进建议。\n</role>\n\n<review_guidelines>\n1. 重点排查潜在的运行时隐患与逻辑漏洞。\n2. 给出简洁、可直接运行的标准修复代码。\n</review_guidelines>`;
    const defaultUser = `针对代码库 {{repo_name}} 的最新提交，请审查以下代码改动：\n\n{{code_diff}}`;
    const newItem: PromptItem = {
      id: `p-${Date.now()}`,
      name: "",
      desc: "",
      systemPrompt: defaultSys,
      userPromptTemplate: defaultUser,
      greeting: "你好！已就绪，随时为您提供专业代码审查服务。",
      isPreset: false,
    };
    setEditingItem(newItem);
    setEditName("");
    setEditDesc("");
    const initChannels: PromptChannel[] = [
      { id: "ch-1", title: "1. AI 专家角色与审查守则", content: defaultSys, isFixed: true },
      { id: "ch-2", title: "2. 发给 AI 的提问句式", content: defaultUser },
    ];
    setChannels(initChannels);
    setActiveChannelId("ch-1");
    setEditGreeting(newItem.greeting || "");
  };

  // 复制提示词
  const handleDuplicate = (p: PromptItem) => {
    const cloned: PromptItem = {
      ...p,
      id: `p-${Date.now()}`,
      name: `${p.name} (副本)`,
      isPreset: false,
    };
    updateList((prev) => [cloned, ...prev]);
    message.success(`已复制生成「${cloned.name}」`);
  };

  // 删除提示词
  const handleDelete = (id: string) => {
    updateList((prev) => prev.filter((p) => p.id !== id));
    message.success("已移除该提示词");
  };

  // 保存正在编辑的内容
  const handleSaveEdit = (applyNow: boolean = false) => {
    if (!editName.trim()) {
      message.warning("请输入提示词名称");
      return;
    }
    const sysContent = channels[0]?.content || "";
    if (!sysContent.trim()) {
      message.warning("第 1 规则通道内容不能为空");
      return;
    }

    const updated: PromptItem = {
      id: editingItem ? editingItem.id : `p-${Date.now()}`,
      name: editName.trim(),
      desc: editDesc.trim() || "暂无说明",
      systemPrompt: sysContent.trim(),
      userPromptTemplate: channels[1]?.content?.trim() || "",
      channels: channels,
      greeting: editGreeting.trim(),
      isPreset: false,
    };

    updateList((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      if (exists) {
        return prev.map((p) => (p.id === updated.id ? updated : p));
      }
      return [updated, ...prev];
    });

    if (applyNow) {
      setSystemPrompt(updated.systemPrompt);
      if (updated.greeting) setGreetingMessage(updated.greeting);
      message.success(`已保存并应用「${updated.name}」！`);
    } else {
      message.success(`已保存「${updated.name}」`);
    }

    setEditingItem(null); // 平滑滑回列表
  };

  // 快捷插入变量到当前活动的富文本编辑器
  const handleInsertVariable = (v: string) => {
    editorRef.current?.insertVariable(v);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 🚀 物理平滑横向滑动双舱轨道 (Dual-Viewport Smooth Glider Track) */}
      {/* 杜绝组件卸载的闪烁与突兀感，0.38s 丝滑推移 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "flex",
          width: "200%",
          height: "100%",
          transform: editingItem !== null ? "translateX(-50%)" : "translateX(0%)",
          transition: "transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      >
        {/* ════════════════════════════════════════════════════════════════════════ */}
        {/* 舱位 1：提示词列表页面 (占 50% 宽度，即完整视口) */}
        {/* ════════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingRight: 6,
            boxSizing: "border-box",
            overflow: "hidden",
            pointerEvents: editingItem !== null ? "none" : "auto",
            opacity: editingItem !== null ? 0.3 : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          {/* 列表页顶部控制栏 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#eef2ff",
                  color: "#4f46e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                <CodeOutlined />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  提示词列表
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b" }}>
                  为代码库选用提示词准则 · 点击任意卡片即可平滑打开直编
                </div>
              </div>
            </div>

            <StudioButton
              variant="primary"
              size="sm"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              新建提示词
            </StudioButton>
          </div>

          {/* 提示词卡片列表滚动区 */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              paddingRight: 2,
            }}
          >
            {prompts.length === 0 ? (
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
                  margin: "10px 0",
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
                  <SlidersOutlined style={{ fontSize: 24, color: "#94a3b8" }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                    暂无自定义提示词准则
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4, maxWidth: 460 }}>
                    大模型需要明确的角色定位与审查准则。点击下方按钮开始编写专属于当前工作流的代码审查规则与执行约束。
                  </div>
                </div>
                <StudioButton
                  variant="primary"
                  size="md"
                  icon={<PlusOutlined />}
                  onClick={handleOpenCreate}
                >
                  新建提示词
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
              {prompts.map((p) => {
                const active = isPromptActive(p);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleOpenEdit(p)}
                    style={{
                      background: active
                        ? "linear-gradient(180deg, #ffffff 0%, #fbfbfe 100%)"
                        : "#ffffff",
                      borderRadius: 12,
                      border: `1.8px solid ${active ? "#6366f1" : "#e2e8f0"}`,
                      boxShadow: active
                        ? "0 4px 16px rgba(99, 102, 241, 0.14)"
                        : "0 1px 3px rgba(0, 0, 0, 0.02)",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 10,
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.borderColor = "#a5b4fc";
                        e.currentTarget.style.transform = "translateY(-1.5px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.borderColor = "#e2e8f0";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    <div>
                      {/* 标题与当前生效标 */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: active ? "#4338ca" : "#0f172a",
                            lineHeight: 1.3,
                          }}
                        >
                          {p.name}
                        </span>

                        {active ? (
                          <Tag
                            color="success"
                            icon={<CheckCircleFilled />}
                            style={{
                              margin: 0,
                              borderRadius: 10,
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "1px 8px",
                            }}
                          >
                            当前使用中
                          </Tag>
                        ) : (
                          <Tag style={{ margin: 0, borderRadius: 10, fontSize: 10.5 }}>
                            待命
                          </Tag>
                        )}
                      </div>

                      {/* 简要说明 */}
                      <div
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}
                      >
                        {p.desc}
                      </div>

                      {/* 提示词片段缩略预览 */}
                      <div
                        style={{
                          background: "#f8fafc",
                          borderRadius: 6,
                          border: "1px solid #f1f5f9",
                          padding: "7px 10px",
                          fontSize: 11,
                          color: "#64748b",
                          fontFamily: "monospace",
                          lineHeight: 1.5,
                          maxHeight: 60,
                          overflow: "hidden",
                        }}
                      >
                        {p.systemPrompt.slice(0, 140)}...
                      </div>
                    </div>

                    {/* 底部操作工具栏 */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 8,
                        borderTop: "1px solid #f1f5f9",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {active ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "#059669",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <CheckOutlined /> 正在作为主审准则
                        </span>
                      ) : (
                        <StudioButton
                          size="xs"
                          variant="primary"
                          icon={<ThunderboltFilled />}
                          onClick={() => handleApply(p)}
                        >
                          使用此提示词
                        </StudioButton>
                      )}

                      <Space size={6}>
                        <StudioButton
                          size="xs"
                          variant="glass"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenEdit(p)}
                        >
                          编辑内容
                        </StudioButton>

                        <Tooltip title="复制为副本">
                          <StudioButton
                            size="xs"
                            variant="ghost"
                            icon={<CopyOutlined />}
                            onClick={() => handleDuplicate(p)}
                          />
                        </Tooltip>

                        {!p.isPreset && (
                          <Popconfirm
                            title="确定移除该提示词？"
                            onConfirm={() => handleDelete(p.id)}
                            okText="移除"
                            cancelText="取消"
                          >
                            <Button
                              size="small"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              style={{ height: 28, fontSize: 11.5 }}
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        )}
                      </Space>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* 列表页底栏 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              padding: "10px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
              boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.02)",
            }}
          >
            <Button
              className="btn-cyber-glass"
              icon={<ArrowLeftOutlined />}
              onClick={onPrevStep}
              style={{ height: 36, fontSize: 12.5 }}
            >
              上一步：代码仓库
            </Button>

            <Space size={10}>
              {onSaveAll && (
                <Button
                  className="btn-cyber-glass"
                  icon={<SaveOutlined style={{ color: "#4f46e5" }} />}
                  onClick={onSaveAll}
                  style={{
                    height: 36,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#4f46e5",
                    borderColor: "#c7d2fe",
                  }}
                >
                  保存配置至数据库
                </Button>
              )}

              <Button
                type="primary"
                className="btn-cyber-primary"
                onClick={onNextStep}
                style={{
                  height: 36,
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: "0 20px",
                }}
              >
                下一步：技能与扩展 (MCP) <ArrowRightOutlined />
              </Button>
            </Space>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════════ */}
        {/* 舱位 2：点开后的提示词全屏编辑直编页面 (一体化大工作台，绝不割裂) */}
        {/* ════════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            paddingLeft: 6,
            boxSizing: "border-box",
            overflow: "hidden",
            pointerEvents: editingItem !== null ? "auto" : "none",
            opacity: editingItem !== null ? 1 : 0.3,
            transition: "opacity 0.3s ease",
          }}
        >
          {/* 🌟 一体化大工作台卡片 (头部操作 + 123+ 包裹富文本，无任何缝隙与割裂感) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: "#ffffff",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.03)",
            }}
          >
            {/* ▌第 1 层：顶部操作与标题栏 (一体化头部，保存就在这里，不割裂) */}
            <div
              style={{
                padding: "10px 18px",
                borderBottom: "1px solid #f1f5f9",
                background: "#fafcff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
                flexShrink: 0,
              }}
            >
              {/* 左侧：返回按钮 + 提示词名称 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <StudioButton
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setEditingItem(null)}
                >
                  返回列表
                </StudioButton>
                <div style={{ width: 1, height: 20, background: "#e2e8f0", flexShrink: 0 }} />

                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>
                    提示词名称:
                  </span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="例如：增量 Commit 体检与运行时防崩溃"
                    style={{
                      flex: 1,
                      minWidth: 160,
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 7,
                      border: "1.5px solid #cbd5e1",
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* 右侧：保存动作组 (去除重复的取消按钮，使用质感按钮) */}
              <Space size={8} style={{ flexShrink: 0 }}>
                <StudioButton
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSaveEdit(false)}
                >
                  仅保存
                </StudioButton>
                <StudioButton
                  variant="primary"
                  size="sm"
                  icon={<SaveOutlined />}
                  onClick={() => handleSaveEdit(true)}
                >
                  保存并生效
                </StudioButton>
              </Space>
            </div>

            {/* ▌第 1.5 层：业务通俗说明 (给团队看的通俗简介备注) */}
            <div
              style={{
                padding: "7px 18px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
                业务说明备注:
              </span>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="例如：重点排查没有做空值判断的链式调用，直接给出可运行代码补丁（给团队看的通俗备注说明）"
                style={{
                  flex: 1,
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  color: "#475569",
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </div>

            {/* ▌第 2 层：高对比度可横向滚动的 1234+ 多通道外壳栏 ("看清字 + 弄个tab滚动 + 支持3个4个") */}
            <div
              style={{
                background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
                borderBottom: "1.5px solid #334155",
                padding: "8px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              {/* 左侧：Mac 圆点 + 可横向滚动的 Tab 列表 + 【+】添加按钮 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                {/* 3 个呼吸小圆点 */}
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                </div>

                {/* 🌟 横向平滑滚动的 Tab 容器 ("弄个tab滚动") */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                    scrollbarWidth: "none",
                    padding: "3px 2px",
                    flex: 1,
                    minWidth: 0,
                  }}
                  className="hide-scrollbar"
                >
                  {channels.map((ch) => {
                    const isActive = ch.id === activeChannelId;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => setActiveChannelId(ch.id)}
                        onDoubleClick={() => handleStartRename(ch)}
                        title="双击重命名此通道"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: editingChannelId === ch.id ? "3px 8px" : "5px 14px",
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: isActive ? 700 : 600,
                          cursor: "pointer",
                          userSelect: "none",
                          transition: "all 0.18s ease",
                          // 高对比度超清晰配色：
                          background: isActive
                            ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
                            : "rgba(255, 255, 255, 0.12)",
                          color: isActive ? "#ffffff" : "#f8fafc",
                          border: isActive
                            ? "1.5px solid #818cf8"
                            : "1px solid rgba(255, 255, 255, 0.25)",
                          boxShadow: isActive ? "0 2px 10px rgba(99, 102, 241, 0.45)" : "none",
                          flexShrink: 0,
                        }}
                      >
                        {editingChannelId === ch.id ? (
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={editingChannelTitle}
                            onChange={(e) => setEditingChannelTitle(e.target.value)}
                            onBlur={() => handleCommitRename(ch.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCommitRename(ch.id);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingChannelId(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            style={{
                              background: "#ffffff",
                              color: "#0f172a",
                              border: "1.5px solid #818cf8",
                              borderRadius: 5,
                              padding: "2px 8px",
                              fontSize: 12,
                              fontWeight: 700,
                              outline: "none",
                              minWidth: 80,
                              maxWidth: 240,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            }}
                          />
                        ) : (
                          <span>{ch.title}</span>
                        )}
                        {/* 允许删除新增的第 3、第 4 等自定义通道 */}
                        {channels.length > 1 && !ch.isFixed && (
                          <span
                            onClick={(e) => handleDeleteChannel(ch.id, e)}
                            title="删除此通道"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              fontSize: 13,
                              fontWeight: 700,
                              color: isActive ? "#ffffff" : "#cbd5e1",
                              marginLeft: 2,
                              lineHeight: 1,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#f43f5e")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? "#ffffff" : "#cbd5e1")}
                          >
                            ×
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* 🌟 醒目的【+】添加通道按钮 ("而且没有+号, 我要是想加3个4个怎么办") */}
                  <button
                    type="button"
                    onClick={handleAddChannel}
                    title="添加第 3、第 4 规则通道"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "4px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: "rgba(99, 102, 241, 0.25)",
                      border: "1.5px dashed #818cf8",
                      color: "#c7d2fe",
                      transition: "all 0.18s ease",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#4f46e5";
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.borderStyle = "solid";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(99, 102, 241, 0.25)";
                      e.currentTarget.style.color = "#c7d2fe";
                      e.currentTarget.style.borderStyle = "dashed";
                    }}
                  >
                    <PlusOutlined /> 加通道
                  </button>
                </div>
              </div>

              {/* 右侧：高对比度 + 变量药丸 (点击一键注入到光标处) */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600 }}>插入变量:</span>
                <button
                  type="button"
                  onClick={() => handleInsertVariable("{{repo_name}}")}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.16)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.28)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                >
                  + 代码仓库名
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertVariable("{{branch}}")}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.16)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.28)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                >
                  + 主干分支
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertVariable("{{latest_commit}}")}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.16)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.28)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.16)")}
                >
                  + 最新提交版本
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertVariable("{{code_diff}}")}
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    cursor: "pointer",
                    background: "rgba(6,182,212,0.35)",
                    color: "#cffafe",
                    border: "1px solid rgba(6,182,212,0.7)",
                    borderRadius: 12,
                    fontWeight: 700,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(6,182,212,0.5)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(6,182,212,0.35)")}
                >
                  + 代码改动差异 {"{{code_diff}}"}
                </button>
              </div>
            </div>

            {/* ▌第 3 层：富文本核心工作区 (高度拉满，一通到底，绝无鸡肋底栏) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <TipTapRichEditor
                ref={editorRef}
                value={activeChannel?.content || ""}
                onChange={handleContentChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step2Prompt;