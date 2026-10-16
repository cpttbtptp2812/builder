import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-security-${randomUUID()}.sqlite`);
process.env.ADMIN_PASSWORD = "A-strong-private-password";

const { assertSafeExternalUrl, customerApiOpen, productionApiGuard } = await import("../server/security.ts");
const { createAdminSession, initializeAdminCredential, isAdminSession, revokeAdminSession } =
  await import("../server/adminAuth.ts");
const { dbGet } = await import("../server/db.ts");

function fail(message: string): never {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

for (const blocked of [
  "http://example.com",
  "https://localhost/private",
  "https://127.0.0.1/private",
  "https://10.1.2.3/private",
  "https://172.16.0.1/private",
  "https://192.168.1.1/private",
  "https://169.254.169.254/latest/meta-data",
]) {
  try {
    assertSafeExternalUrl(blocked);
    fail(`SSRF 地址未拦截：${blocked}`);
  } catch {
    // expected
  }
}
if (assertSafeExternalUrl("https://example.com/path").hostname !== "example.com") fail("正常 https 地址被拒绝");
console.log("PASS  SSRF URL policy");

initializeAdminCredential();
const stored = dbGet<{ value: string }>("SELECT value FROM app_config WHERE key='admin_password_hash'")?.value ?? "";
if (!stored.startsWith("scrypt:") || stored.includes(process.env.ADMIN_PASSWORD)) fail("管理员密码没有安全哈希");
if (createAdminSession("wrong-password")) fail("错误密码不应创建会话");
const token = createAdminSession(process.env.ADMIN_PASSWORD);
if (!token || !isAdminSession(token)) fail("正确密码应创建可用会话");
if (token.includes(process.env.ADMIN_PASSWORD)) fail("会话 token 不得包含密码");
revokeAdminSession(token);
if (isAdminSession(token)) fail("登出后 token 应失效");
console.log("PASS  admin password hash + revocable opaque session");

const legacy = dbGet<{ value: string }>("SELECT value FROM app_config WHERE key='admin_password'");
if (legacy) fail("不得写入旧的明文管理员密码配置");
console.log("PASS  no default/plaintext admin password");

for (const [method, path, open] of [
  ["POST", "/api/llm/probe", true],
  ["POST", "/api/llm/models", true],
  ["POST", "/api/llm/byok/chat", true],
  ["POST", "/api/llm/byok/stream", true],
  ["POST", "/api/product-run/stream", true],
  ["GET", "/api/skills/live", true],
  ["GET", "/api/runtime/config", true],
  ["GET", "/api/admin/knowledge", false],
  ["POST", "/api/skill-gate/publish", false],
  ["GET", "/api/internal/metrics", false],
] as const) {
  if (customerApiOpen(path, method) !== open) fail(`客户接口判定错误 ${method} ${path}`);
}

const previousEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
let customerReached = false;
await productionApiGuard(
  { req: { path: "/api/llm/probe", method: "POST", header: () => undefined } } as never,
  async () => {
    customerReached = true;
  },
);
if (!customerReached) fail("客户测试模型不应要求办事凭证");
const denied = await productionApiGuard(
  {
    req: { path: "/api/admin/knowledge", method: "GET", header: () => undefined },
    json: (body: unknown, status: number) => ({ body, status }),
  } as never,
  async () => {
    fail("未登录不得进入管理接口");
  },
);
if (!denied || (denied as { status?: number }).status !== 401) fail("管理接口应返回 401");
process.env.NODE_ENV = previousEnv;
console.log("PASS  customer product routes open, admin routes closed");

console.log("\nproduction security checks OK");
