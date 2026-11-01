import React, { useState, useRef, useEffect } from "react";
import {
  Row,
  Col,
  Button,
  Tag,
  Input,
  Typography,
  Space,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  SlidersOutlined,
  PlayCircleOutlined,
  BranchesOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  RocketFilled,
  ThunderboltFilled,
  CompassOutlined,
  CheckOutlined,
  RightOutlined,
  CodeOutlined,
  FileTextOutlined,
  SettingOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import { PipelineItem, DEFAULT_ENTERPRISE_WORKFLOWS } from "../../types/platform";
import WorkflowStepWizard from "./WorkflowStepWizard";

const { Title, Text, Paragraph } = Typography;

// 3 个生产级标杆方案（正好一行三个，结构饱满、小巧精致）
const PRESET_SHOWCASE_WORKFLOWS: PipelineItem[] = [
  {
    ...DEFAULT_ENTERPRISE_WORKFLOWS[0],
    name: "Git 仓库实时监控与代码智能体",
    category: "代码协同",
    badge: "生产标杆",
    version: "v1.8.0",
    tags: ["Commit 监听", "防空指针", "密钥防泄露", "直修补丁"],
  },
  {
    id: "wf-api-contract-guard",
    name: "微服务接口协同与合规体检智能体",
    description: "监控后端 API 变更对前端和移动端的调用兼容性，自动排查字段断裂、类型不匹配，守护跨服务稳定交付。",
    category: "架构协同",
    badge: "架构防崩",
    version: "v1.5.0",
    tags: ["接口契约", "跨端联调", "版本防崩", "类型对齐"],
    enabled: true,
    promptTemplate: "请分析本次接口定义的修改，评估是否会导致下游服务或前端工程调用发生破坏性不兼容？",
  },
  {
    ...DEFAULT_ENTERPRISE_WORKFLOWS[1],
    name: "企业级多维数据清洗与智能治理体",
    category: "数据智能",
    badge: "质量保障",
    version: "v2.0.0",
    tags: ["数据查重", "空值填充", "离群值检测", "SQL 质检"],
  },
];

interface WorkflowsListPageProps {
  workflows: PipelineItem[];
  onLaunchWorkflow: (wf: PipelineItem) => void;
  onFillPrompt?: (wf: PipelineItem) => void;
  onOpenCreate?: () => void;
  onOpenEdit?: (wf: PipelineItem) => void;
  onDelete: (id: string) => void;
  onSaveWorkflow?: (wf: PipelineItem) => void;
  hideHeader?: boolean;
}

export const WorkflowsListPage: React.FC<WorkflowsListPageProps> = ({
  workflows,
  onLaunchWorkflow,
  onFillPrompt,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onSaveWorkflow,
  hideHeader = false,
}) => {
  const [viewMode, setViewMode] = useState<"hub" | "studio">("hub");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeWorkflow, setActiveWorkflow] = useState<PipelineItem | null>(null);

  // 分类平滑流动指示器
  const catContainerRef = useRef<HTMLDivElement | null>(null);
  const [catIndicator, setCatIndicator] = useState<{ left: number; width: number }>({ left: 3, width: 92 });
  const catItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const targetEl = catItemRefs.current[selectedCategory];
    if (targetEl && catContainerRef.current) {
      const containerRect = catContainerRef.current.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      setCatIndicator({
        left: targetRect.left - containerRect.left,
        width: targetRect.width,
      });
    }
  }, [selectedCategory]);

  const displayList: PipelineItem[] = PRESET_SHOWCASE_WORKFLOWS;

  const allCategories = [
    { label: "全部精选方案", value: "ALL", count: displayList.length },
    { label: "代码协同与评审", value: "代码协同", count: 1 },
    { label: "微服务与接口契约", value: "架构协同", count: 1 },
    { label: "数据智能与治理", value: "数据智能", count: 1 },
  ];

  const filteredWorkflows = displayList.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(search.toLowerCase())) ||
      (w.tags && w.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
    const matchesCategory = selectedCategory === "ALL" || w.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEditWorkflow = (wf: PipelineItem) => {
    // 仅传递方案基础身份，避免卡片携带过时或未同步的内存假数据，强制 Wizard 100% 以数据库 dslJson 为准
    const targetWf = { id: wf.id, name: wf.name, description: wf.description };
    if (onOpenEdit) {
      onOpenEdit(targetWf as any);
    } else {
      setActiveWorkflow(targetWf as any);
      setViewMode("studio");
    }
  };

  const handleCreateNew = () => {
    if (onOpenCreate) {
      onOpenCreate();
    } else {
      const newWf: PipelineItem = {
        id: `wf-${Date.now().toString().slice(-6)}`,
        name: "新建自定义代码守护智能体",
        version: "v1.0.0",
        category: "代码协同",
        badge: "全新方案",
        gitRepositories: [],
        skills: [],
        mcpServers: [],
        enabled: true,
      };
      setActiveWorkflow(newWf);
      setViewMode("studio");
    }
  };

  if (viewMode === "studio" && activeWorkflow) {
    return (
      <WorkflowStepWizard
        workflow={activeWorkflow}
        onBack={() => setViewMode("hub")}
        onSave={(saved) => {
          if (onSaveWorkflow) onSaveWorkflow(saved);
          setActiveWorkflow(saved);
        }}
      />
    );
  }

  // 获取方案专属的装配可视化链路节点
  const getPipelineSteps = (id: string) => {
    if (id.includes("git")) {
      return [
        { label: "Git 仓库监听", color: "#4f46e5" },
        { label: "AI 规则体检", color: "#3b82f6" },
        { label: "输出直修补丁", color: "#10b981" },
      ];
    }
    if (id.includes("api")) {
      return [
        { label: "接口变更捕获", color: "#059669" },
        { label: "跨端破坏性检测", color: "#0284c7" },
        { label: "类型定义同步", color: "#16a34a" },
      ];
    }
    return [
      { label: "多源数据接入", color: "#d97706" },
      { label: "质量规则体检", color: "#f59e0b" },
      { label: "清洗方案执行", color: "#10b981" },
    ];
  };

  // 获取方案专属的核心防线清单
  const getFeatureBullets = (id: string) => {
    if (id.includes("git")) {
      return [
        "Commit 提交毫秒级差分自动感知",
        "严防 AK/SK 云密钥与数据库密码硬编码",
        "敏捷直修风格，一键输出可复制替换代码",
      ];
    }
    if (id.includes("api")) {
      return [
        "前后端 API 契约不一致自动告警",
        "防止关键字段重命名导致移动端崩溃",
        "自动生成 TypeScript / OpenAPI 规范补丁",
      ];
    }
    return [
      "SQL 与非结构化数据脏数据清洗",
      "空值填充、离群异常值自适应修复",
      "零破坏只读沙箱，执行过程全程留痕",
    ];
  };

  return (
    <div
      className="cyber-grid-canvas"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "24px 36px 60px",
        overflowY: "auto",
        gap: 24,
      }}
    >
      {/* 1. 一体化现代工作流工坊控制中枢 (合二为一，消除原先呆板叠放的两个白框) */}
      {!hideHeader && (
        <div
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8faff 50%, #eff6ff 100%)",
            borderRadius: 20,
            padding: "22px 28px",
            border: "1px solid #e0e7ff",
            boxShadow: "0 10px 30px -10px rgba(99, 102, 241, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* 上半部：工坊标题、说明与新建主按钮 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>
                  业务流与智能体方案工坊
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: "#eef2ff",
                    color: "#4f46e5",
                    border: "1px solid #c7d2fe",
                    letterSpacing: "0.2px",
                  }}
                >
                  ✦ STUDIO PRO
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                开箱即用的 3 大生产级标杆方案。支持一键载入工作台直接协同，或通过可视化向导定制专属于你团队的代码守护者。
              </div>
            </div>

            <Button
              type="primary"
              className="btn-cyber-primary"
              icon={<PlusOutlined />}
              onClick={handleCreateNew}
              style={{
                height: 40,
                padding: "0 22px",
                fontSize: 13,
              }}
            >
              创建专属业务流
            </Button>
          </div>

          {/* 内嵌精致分割线 */}
          <div style={{ height: 1, background: "rgba(224, 231, 255, 0.8)" }} />

          {/* 下半部：分类磁吸胶囊 + 快速检索 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {/* 现代化磁吸滑动流光分类切换器 */}
            <div
              ref={catContainerRef}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "#f1f5f9",
                padding: "3px 4px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.03)",
              }}
            >
              {/* 滑动游标高亮胶囊 */}
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  bottom: 3,
                  left: 0,
                  transform: `translateX(${catIndicator.left}px)`,
                  width: `${catIndicator.width}px`,
                  background: "#ffffff",
                  borderRadius: 6,
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(99, 102, 241, 0.08)",
                  transition: "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), width 0.26s cubic-bezier(0.16, 1, 0.3, 1)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />

              {allCategories.map((c) => {
                const isActive = selectedCategory === c.value;
                return (
                  <div
                    key={c.value}
                    ref={(el) => (catItemRefs.current[c.value] = el)}
                    onClick={() => setSelectedCategory(c.value)}
                    style={{
                      position: "relative",
                      zIndex: 2,
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#4338ca" : "#64748b",
                      cursor: "pointer",
                      transition: "color 0.2s ease",
                      userSelect: "none",
                    }}
                  >
                    <span>{c.label}</span>
                    <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>({c.count})</span>
                  </div>
                );
              })}
            </div>

            {/* 搜索栏与状态信标 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Input
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                placeholder="搜索方案名称或技能标签..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240, borderRadius: 8, height: 34, borderColor: "#cbd5e1" }}
                allowClear
              />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#16a34a",
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#16a34a",
                    boxShadow: "0 0 6px #16a34a",
                    display: "inline-block",
                  }}
                />
                <span>规则沙箱实时就绪</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. 方案卡片 Bento 网格：一行三个，彻底重构结构，小巧精致且充满科技感 */}
      <Row gutter={[20, 20]}>
        {filteredWorkflows.map((wf) => {
          const isGit = wf.id.includes("git");
          const isApi = wf.id.includes("api");
          const pipelineSteps = getPipelineSteps(wf.id);
          const bullets = getFeatureBullets(wf.id);

          const themeColor = isGit ? "#4f46e5" : isApi ? "#059669" : "#d97706";
          const themeBg = isGit ? "#eef2ff" : isApi ? "#f0fdf4" : "#fffbeb";
          const themeBorder = isGit ? "#c7d2fe" : isApi ? "#a7f3d0" : "#fed7aa";

          return (
            <Col xs={24} md={12} lg={8} key={wf.id}>
              <div
                className="card-depth-island"
                style={{
                  background: "#ffffff",
                  borderRadius: 18,
                  padding: "20px 22px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 16px rgba(15, 23, 42, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = `0 12px 28px -6px ${themeColor}22`;
                  e.currentTarget.style.borderColor = themeBorder;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 16px rgba(15, 23, 42, 0.03)";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }}
              >
                {/* 顶部微色装饰条 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${themeColor} 0%, ${themeColor}33 100%)`,
                  }}
                />

                <div>
                  {/* 头部：图标 + 标题 + 版本徽标 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: themeBg,
                          color: themeColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        {isGit ? <BranchesOutlined /> : isApi ? <ApiOutlined /> : <DatabaseOutlined />}
                      </div>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                          {wf.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>
                          {wf.version || "v1.0.0"} · 生产标杆
                        </div>
                      </div>
                    </div>

                    <Tag
                      style={{
                        margin: 0,
                        borderRadius: 20,
                        fontSize: 10.5,
                        padding: "1px 8px",
                        background: themeBg,
                        color: themeColor,
                        border: `1px solid ${themeBorder}`,
                        fontWeight: 700,
                      }}
                    >
                      ● {wf.badge || "已就绪"}
                    </Tag>
                  </div>

                  {/* 方案装配可视化流水线 (创新的核心结构，让方案运转方式一目了然) */}
                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: 10,
                      padding: "8px 12px",
                      marginBottom: 12,
                      border: "1px solid #f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {pipelineSteps.map((s, idx) => (
                      <React.Fragment key={idx}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                          <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{s.label}</span>
                        </div>
                        {idx < pipelineSteps.length - 1 && (
                          <span style={{ color: "#cbd5e1", fontSize: 10 }}>➔</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* 核心防护清单 (结构清晰，告别原先容易换行破损的大段文字) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                    {bullets.map((b, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                        <CheckOutlined style={{ color: "#16a34a", fontSize: 11, flexShrink: 0 }} />
                        <span style={{ lineHeight: 1.4 }}>{b}</span>
                      </div>
                    ))}
                  </div>

                  {/* 技能标签微条 */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
                    {wf.tags?.slice(0, 4).map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 11,
                          padding: "2px 7px",
                          borderRadius: 4,
                          background: "#f1f5f9",
                          color: "#64748b",
                          border: "1px solid #e2e8f0",
                          fontFamily: "monospace",
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 底部操作行：向导配置与载入运行 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 12,
                    borderTop: "1px solid #f1f5f9",
                    gap: 8,
                  }}
                >
                  <Button
                    size="small"
                    icon={<SlidersOutlined />}
                    onClick={() => handleEditWorkflow(wf)}
                    style={{
                      borderRadius: 7,
                      fontSize: 12,
                      color: "#475569",
                      height: 32,
                      padding: "0 12px",
                      fontWeight: 500,
                    }}
                  >
                    向导配置
                  </Button>

                  <Button
                    size="small"
                    type="primary"
                    className="btn-action-probe"
                    icon={<PlayCircleOutlined />}
                    onClick={() => onLaunchWorkflow(wf)}
                    style={{
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 700,
                      height: 32,
                      padding: "0 14px",
                      background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
                      border: "none",
                      boxShadow: `0 2px 8px ${themeColor}33`,
                    }}
                  >
                    载入工作台运行 ↗
                  </Button>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* 3. 底部快捷蓝图构建指引 (工坊沉浸式扩展) */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "20px 24px",
          border: "1px dashed #cbd5e1",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#eef2ff",
              color: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            <CompassOutlined />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
              想要为团队定制全新场景？
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              支持从任意代码仓库一键初始化，或自由装配防死锁、防接口破坏等专长规则。
            </div>
          </div>
        </div>

        <Space>
          <Button
            size="small"
            onClick={handleCreateNew}
            style={{
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              color: "#4f46e5",
              borderColor: "#c7d2fe",
              background: "#f8faff",
            }}
          >
            + 从空白方案搭建
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default WorkflowsListPage;
