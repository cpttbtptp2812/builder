const http = require("http");

function request(method, path, body) {
  return new Promise((resolve) => {
    const postData = body ? Buffer.from(JSON.stringify(body), "utf-8") : null;
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
        let b = "";
        res.setEncoding("utf-8");
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(b) });
          } catch {
            resolve({ status: res.statusCode, data: b });
          }
        });
      }
    );
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("1. 模拟调用工具执行高危写操作 UPDATE...");
  const t1 = await request("POST", "/api/tools/test", {
    toolName: "query_enterprise_db",
    payload: { sql: "UPDATE chat_session SET title = '已核准会话' WHERE 1=2" },
  });
  console.log("拦截结果:", t1.status, t1.data.msg);

  console.log("2. 查验数据库生成的审批单...");
  const t2 = await request("GET", "/api/approval/tickets");
  console.log("审批单数量:", t2.data.length);
  const ticket = t2.data[0];
  console.log("当前最新单据:", {
    id: ticket.id,
    status: ticket.status,
    sql: ticket.operationSummary,
    reason: ticket.auditReason,
  });

  console.log("3. 触发人工核准 (Human-in-the-Loop APPROVE)...");
  const t3 = await request("POST", "/api/approval/decide", {
    ticketId: ticket.id,
    action: "APPROVE",
    approver: "首席安全架构师",
  });
  console.log("审批决断返回:", t3.data);

  console.log("4. 再次验证单据持久化状态...");
  const t4 = await request("GET", "/api/approval/tickets");
  const updated = t4.data.find((x) => x.id === ticket.id);
  console.log("最终落地状态:", {
    id: updated.id,
    status: updated.status,
    operator: updated.operatorId,
    decidedAt: updated.decidedAt,
  });
}

run().catch(console.error);

