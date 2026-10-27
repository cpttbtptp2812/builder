const http = require("http");

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? Buffer.from(JSON.stringify(data), "utf-8") : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8080,
        path,
        method,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...(postData ? { "Content-Length": postData.length } : {}),
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        });
      }
    );
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("1. 清空旧切片...");
  const oldList = await request("GET", "/api/knowledge/all");
  if (Array.isArray(oldList)) {
    for (const c of oldList) {
      await request("DELETE", `/api/knowledge/${c.id}`);
      console.log(`已删除旧切片: ${c.id}`);
    }
  }

  console.log("2. 写入三篇纯正 UTF-8 企业级标准技术规范文档...");

  const doc1 = {
    title: "研发中心架构规范：基于 Spring Boot 3 与 Java 21 虚拟线程最佳实践",
    category: "ARCHITECTURE",
    keywords: "Spring Boot 3, Java 21, 虚拟线程, Loom, 高并发, Pinning锁死, 性能调优",
    content:
      "研发中心微服务技术选型与生产落地规范（2026版）：\n" +
      "1. 核心线程模型演进：系统全量升级至 Java 21 LTS 与 Spring Boot 3.2+。全面启用 Project Loom 虚拟线程替代传统平台线程（Platform Threads）。\n" +
      "2. 高吞吐核心优势：虚拟线程为 JVM 调度的用户态轻量级线程，单实例可承载 100 万并发会话，内存开销从单线程 1MB 降至几百字节，大幅降低上下文切换的 CPU 损耗。\n" +
      "3. 避坑军规：生产环境严格杜绝在长耗时 I/O 阻塞代码块中使用 synchronized 关键字，必须改用 java.util.concurrent.locks.ReentrantLock，防止底层载体线程（Carrier Thread）被钉死（Pinning）。\n" +
      "4. 严禁池化：虚拟线程创建成本极低，应即用即销毁，切勿使用 ThreadPoolExecutor 进行池化管理。",
  };

  const doc2 = {
    title: "生产数据库安全运维军规：高危写操作与审批流规范",
    category: "DATABASE_SECURITY",
    keywords: "数据库安全, 只读SQL, 高危操作, 人机审批, DDL拦截, 审计日志",
    content:
      "生产环境数据库访问与自动化 Agent 运维管控红线：\n" +
      "1. 权限分级控制：所有日常查询必须通过只读只读连接池执行，默认仅放行 SELECT、SHOW、EXPLAIN 语句。\n" +
      "2. 高危操作拦截：严禁 Agent 自动执行非 SELECT 语句（包含 UPDATE、DELETE、INSERT、DROP、TRUNCATE、ALTER 等）。\n" +
      "3. 人机审批流（Human-in-the-Loop）：一旦 Agent 解析出或意图执行任何涉及数据变动的操作，必须触发安全熔断，将任务持久化为 PENDING_APPROVAL 挂起状态。\n" +
      "4. 审批与断点续跑：前端运营平台展示审批单卡片，明确呈现拟执行 SQL、受影响表、操作人；经合规架构师手工点击批准后，状态机方可唤醒并执行该操作，全流程记录不可篡改的审计日志。",
  };

  const doc3 = {
    title: "企业差旅与财务报销制度操作指引手册",
    category: "FINANCE_POLICY",
    keywords: "员工手册, 报销规范, 差旅标准, 住宿补贴, 审批时效",
    content:
      "企业员工日常报销与财务管理规范（员工手册第4章）：\n" +
      "1. 差旅交通报销标准：跨城市出差优先选择高铁二等座或经济舱机票。机票需提前在企业内网差旅系统统一预订。\n" +
      "2. 住宿与餐饮补贴：一线城市住宿标准每晚不超过 500 元人民币，三餐补贴为每日 120 元，实报实销并需附带正规增值税发票。\n" +
      "3. 报销单提交与审批时效：员工产生费用后应在 30 个自然日内提报，经直属部门主管与财务审批后，系统在每周五统一下发银行打款。",
  };

  const r1 = await request("POST", "/api/knowledge/upload", doc1);
  console.log("入库文档1:", r1.docTitle, "片数:", r1.totalChunks);

  const r2 = await request("POST", "/api/knowledge/upload", doc2);
  console.log("入库文档2:", r2.docTitle, "片数:", r2.totalChunks);

  const r3 = await request("POST", "/api/knowledge/upload", doc3);
  console.log("入库文档3:", r3.docTitle, "片数:", r3.totalChunks);

  console.log("3. 验证中文检索召回效果...");
  const s1 = await request("POST", "/api/knowledge/search", { query: "员工手册报销规范" });
  console.log("搜索「员工手册报销规范」命中数:", s1.length, s1.map((c) => ({ title: c.docTitle, bm25: c.bm25Score, rrf: c.rrfScore })));

  const s2 = await request("POST", "/api/knowledge/search", { query: "虚拟线程核心优势" });
  console.log("搜索「虚拟线程核心优势」命中数:", s2.length, s2.map((c) => ({ title: c.docTitle, bm25: c.bm25Score, rrf: c.rrfScore })));
}

run().catch(console.error);

