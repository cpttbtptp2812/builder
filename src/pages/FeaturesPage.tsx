const MAP = [
  {
    product: "tianyangAgent / agent",
    items: [
      "登录 / 会话 Cookie",
      "Dashboard 对话 + 流式 SSE",
      "多智能体选择与开场白",
      "消息：复制 / 点赞 / 收藏 / 重新生成",
      "工作流浮窗 pause / resume",
      "历史三 Tab：对话 / 定时任务 / 收藏",
      "GraphQL 持久化 dialogs",
    ],
  },
  {
    product: "tianyangBase / imean-ai",
    items: [
      "嵌入式浮窗 + 登录门",
      "chatMatchWorkflows 匹配列表",
      "频道 / 场景工作流目录",
      "process 卡片：步骤 / 暂停 / 错误",
      "组件流：LLM / HTTP / ImportTable / Wait",
      "DOM 回放 scheduler",
      "完成后评价 addPraise / addDislike",
    ],
  },
  {
    product: "本作品集（已实现）",
    items: [
      "✅ 个人作品集首页（简历级项目展示）",
      "✅ 对话流式 + 工作流匹配卡",
      "✅ 执行进度 + 评价",
      "✅ 工具结果卡（Knowledge/MCP 示意）",
      "✅ 智能体 / 工作流库 / 历史",
      "✅ 百度 BOS 静态托管 + SEO",
      "⬜ 真实 GraphQL / SSE（需部署 agent 后端）",
      "⬜ 浏览器 DOM 回放（需 imean SDK）",
    ],
  },
];

export function FeaturesPage() {
  return (
    <div className="page">
      <header>
        <h1>能力地图</h1>
        <p>对照 agent / imean-ai 仓库，说明本作品集演示覆盖范围</p>
      </header>
      <div className="map">
        {MAP.map((col) => (
          <section key={col.product} className="map-col">
            <h2>{col.product}</h2>
            <ul>
              {col.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
