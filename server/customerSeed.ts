/** 客户产品默认数据 — 知识库 / 广场 / 制度 / 能力规则（仅首次空库写入） */

import { randomUUID } from "node:crypto";
import { dbGet, dbRun, nowIso } from "./db.ts";
import { faqKnowledgeDocs } from "../src/data/productFaq.ts";

function insertConfig(key: string, value: string) {
  dbRun("INSERT OR IGNORE INTO app_config(key,value,updated_at) VALUES(?,?,?)", [key, value, nowIso()]);
}

export function seedCustomerData() {
  const now = nowIso();

  /* ── 应用默认配置 ── */
  insertConfig("app_name", "OwnAgent 知识助手");
  insertConfig("app_description", "企业团队知识值班系统：先搜广场、再问 AI、答完共享");
  insertConfig("welcome_message", "您好，有什么可以帮您？");
  insertConfig("theme_color", "#6366f1");
  insertConfig("plaza_match_threshold", "70");
  insertConfig("plaza_hint_threshold", "40");
  insertConfig("prefer_server_rag", "true");
  insertConfig("prefer_server_guest", "true");
  insertConfig("prefer_server_multi_agent", "true");
  insertConfig("prefer_server_eval", "true");
  insertConfig("plaza_first_enabled", "true");
  insertConfig("allow_anonymous_publish", "true");
  insertConfig("low_confidence_threshold", "65");

  /* ── 知识库文档 ── */
  const kbCount = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM knowledge_docs")?.c ?? 0;
  if (kbCount === 0) {
    const docs = [
      {
        id: "kb-product",
        title: "产品介绍",
        body: "OwnAgent 是企业内部 AI 知识助手。支持知识库管理、知识广场共享问答、先搜再问节省 Token。管理员可在后台查看缺口清单、低置信度回答和运营数据。支持 Docker 私有化部署，数据存储在客户自己的 SQLite 数据库中。",
        prompts: ["产品是做什么的", "OwnAgent 有哪些功能", "怎么部署"],
        tags: ["产品", "介绍"],
      },
      {
        id: "kb-pricing",
        title: "价格与套餐",
        body: "标准版：按年订阅，含 5 个管理员账号、无限知识文档、广场共享。企业版：私有化部署 + 定制能力锁 + SSO 对接。试用版：14 天免费，最多 500 次 AI 问答。续费联系商务：sales@example.com。",
        prompts: ["怎么收费", "有免费版吗", "企业版多少钱"],
        tags: ["价格", "商务"],
      },
      {
        id: "kb-deploy",
        title: "部署与运维",
        body: "推荐使用 Docker Compose 一键部署：docker compose up -d。环境变量：ADMIN_PASSWORD、DEEPSEEK_API_KEY、DATABASE_PATH。数据目录挂载到 ./data 持久化。Nginx 反向代理需开启 SSE 支持。管理后台地址：/admin，默认密码 admin123（部署后请修改）。",
        prompts: ["怎么部署", "Docker 怎么启动", "管理后台在哪"],
        tags: ["部署", "运维"],
      },
      {
        id: "kb-faq",
        title: "常见问题",
        body: "Q：AI 回答不对怎么办？A：在知识库补充更准确的内容，或将正确版本发布到广场。\nQ：为什么要先搜广场？A：广场里是同事验证过的答案，命中后零 Token 消耗。\nQ：如何导入现有文档？A：管理后台知识库支持文件、网页 URL、Markdown 粘贴批量导入。",
        prompts: ["AI 回答不对怎么办", "为什么要先搜广场", "怎么导入文档"],
        tags: ["FAQ", "帮助"],
      },
    ];
    for (const d of docs) {
      dbRun(
        "INSERT INTO knowledge_docs(id,title,body,prompts,tags,enabled,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)",
        [d.id, d.title, d.body, JSON.stringify(d.prompts), JSON.stringify(d.tags), now, now],
      );
    }
  }

  /* ── 产品问答（按 id 补齐，后台改过的不覆盖） ── */
  for (const d of faqKnowledgeDocs()) {
    dbRun(
      "INSERT OR IGNORE INTO knowledge_docs(id,title,body,prompts,tags,enabled,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)",
      [d.id, d.title, d.body, JSON.stringify(d.prompts), JSON.stringify(["产品问答"]), now, now],
    );
  }

  /* ── 知识广场 ── */
  const plazaCount = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM published_qa")?.c ?? 0;
  if (plazaCount === 0) {
    const colors = ["#6366f1", "#059669", "#0891b2", "#d97706"];
    const items = [
      {
        q: "OwnAgent 是做什么的？",
        a: "OwnAgent 是企业内部 AI 知识助手，核心流程是「先搜知识广场、再问 AI、答完发布共享」。适合客服、实施、HR 等团队减少重复问答。",
        author: "产品团队",
        tags: ["产品"],
      },
      {
        q: "怎么部署 OwnAgent？",
        a: "推荐 Docker Compose：docker compose up -d。配置 ADMIN_PASSWORD 和 LLM API Key 后，访问 /admin 管理知识库。数据持久化在 ./data 目录。",
        author: "运维同事",
        tags: ["部署"],
      },
      {
        q: "AI 回答不准确怎么办？",
        a: "1. 在管理后台「知识库」补充更准确内容；2. 将正确问答「发布到广场」；3. 在「知识运营」查看低置信度回答并校对。",
        author: "客服主管",
        tags: ["FAQ"],
      },
      {
        q: "标准版和企业版有什么区别？",
        a: "标准版：SaaS 订阅，5 管理员，无限文档。企业版：私有化部署、能力锁配置、SSO、专属支持。详情联系 sales@example.com。",
        author: "商务",
        tags: ["价格"],
      },
    ];
    items.forEach((it, i) => {
      dbRun(
        `INSERT INTO published_qa(id,question,answer,author,avatar_color,source_doc,tags,likes,views,pinned,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,0,0,?, ?,?)`,
        [
          `qa-seed-${i + 1}`,
          it.q,
          it.a,
          it.author,
          colors[i % colors.length],
          null,
          JSON.stringify(it.tags),
          i === 0 ? 1 : 0,
          now,
          now,
        ],
      );
    });
  }

  /* ── 制度条款 ── */
  const policyCount = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM policy_clauses")?.c ?? 0;
  if (policyCount === 0) {
    const clauses = [
      { id: "KB-休假-现行-1年", topic: "leave", status: "current", text: "现行制度：员工司龄满 1 年，年假 10 天。", slot: "leave.days", value: "10", condition: "司龄≥1年" },
      { id: "KB-休假-现行-5年", topic: "leave", status: "current", text: "现行制度：员工司龄满 5 年，年假 15 天。", slot: "leave.days", value: "15", condition: "司龄≥5年" },
      { id: "KB-休假-2022废止", topic: "leave", status: "abolished", text: "已废止（2022）：入职即可休年假 5 天。不得与现行天数写进同一句。", slot: "leave.days", value: "5", condition: "已废止" },
      { id: "KB-加班-禁止抵假", topic: "overtime", status: "current", text: "加班不得抵扣年假。休假与加班制度均写明禁止。", slot: "leave.offset", value: "forbidden", condition: "" },
      { id: "KB-报销-发票", topic: "reimburse", status: "current", text: "报销须附合规发票，缺发票不得入账。", slot: "reimburse.invoice", value: "required", condition: "" },
      { id: "KB-VPN-工单", topic: "vpn", status: "current", text: "开通 VPN、更换设备、改系统权限必须走工单，对话里不得直接开通。", slot: "vpn.channel", value: "ticket", condition: "" },
    ];
    clauses.forEach((c, i) => {
      dbRun(
        `INSERT INTO policy_clauses(id,topic,status,text,slot,value,condition_text,sort_order,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,1,?,?)`,
        [c.id, c.topic, c.status, c.text, c.slot, c.value, c.condition, i, now, now],
      );
    });
  }

  /* ── 能力规则 ── */
  const capCount = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM capability_rules")?.c ?? 0;
  if (capCount === 0) {
    const rules = [
      { name: "手册外事实", cap: "abstain", pattern: "上市|天气|股价|几点了|今天星期", reason: "手册外事实，不允许编造", priority: 10 },
      { name: "改权限操作", cap: "mutate", pattern: "开通|vpn|换电脑|更换设备|改权限|蓝屏|重置密码", reason: "会改系统状态，只许起草工单", priority: 20 },
      { name: "年假制度", cap: "read", pattern: "年假|休假|请假", reason: "制度问答 · 年假", priority: 30 },
      { name: "加班制度", cap: "read", pattern: "加班", reason: "制度问答 · 加班", priority: 31 },
      { name: "报销制度", cap: "read", pattern: "报销", reason: "制度问答 · 报销", priority: 32 },
      { name: "通用制度", cap: "read", pattern: "制度|手册|工单", reason: "制度问答", priority: 40 },
    ];
    rules.forEach((r, i) => {
      dbRun(
        `INSERT INTO capability_rules(id,name,cap,pattern,reason,priority,enabled,created_at,updated_at)
         VALUES(?,?,?,?,?,?,1,?,?)`,
        [`cap-${randomUUID().slice(0, 8)}`, r.name, r.cap, r.pattern, r.reason, r.priority, now, now],
      );
    });
  }

  /* ── 示例运营日志（便于运营台有数据可看） ── */
  const logCount = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM chat_sessions")?.c ?? 0;
  if (logCount === 0) {
    const samples = [
      { q: "怎么部署", mode: "plaza", plaza_hit: 1, groundedness: 95, hit_count: 3, latency: 120 },
      { q: "私有化部署支持吗", mode: "llm", plaza_hit: 0, groundedness: 72, hit_count: 2, latency: 2400 },
      { q: "SSO 单点登录什么时候支持", mode: "llm", plaza_hit: 0, groundedness: 28, hit_count: 0, latency: 3100 },
      { q: "怎么收费", mode: "plaza", plaza_hit: 1, groundedness: 90, hit_count: 2, latency: 95 },
      { q: "API 限流策略是什么", mode: "llm", plaza_hit: 0, groundedness: 35, hit_count: 0, latency: 2800 },
      { q: "AI 回答不对怎么办", mode: "plaza", plaza_hit: 1, groundedness: 88, hit_count: 1, latency: 110 },
      { q: "满一年年假几天", mode: "policy", plaza_hit: 0, groundedness: 92, hit_count: 2, latency: 800 },
    ];
    for (const s of samples) {
      dbRun(
        `INSERT INTO chat_sessions(id,session_id,query,answer_preview,answer_length,groundedness,hit_count,latency_ms,mode,plaza_hit,published,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          randomUUID(),
          "seed-session",
          s.q,
          "（示例回答）",
          120,
          s.groundedness,
          s.hit_count,
          s.latency,
          s.mode,
          s.plaza_hit,
          s.plaza_hit ? 1 : 0,
          now,
        ],
      );
    }
  }
}
