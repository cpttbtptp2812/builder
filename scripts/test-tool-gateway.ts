/** 没授予的权限不执行；超时的调用停下来并记下耗时。 */
import { invokeThroughGateway } from "../server/toolGateway.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const denied = await invokeThroughGateway({
  name: "http_probe",
  grant: ["read"],
  run: async () => {
    fail("没有网络权限时不应该真的去调用");
  },
});
expect(denied.isError === true && denied.gateway.allowed === false && denied.gateway.capability === "network", "缺权限时应拒绝且标明需要访问网络");

const slow = await invokeThroughGateway({
  name: "read_rows",
  grant: ["read"],
  timeoutMs: 30,
  run: () => new Promise(() => {}),
});
expect(slow.isError === true && slow.gateway.allowed === true, "超时的调用曾经获准执行");
const body = slow.content as { code?: string };
expect(body.code === "TOOL_TIMEOUT", `超时应返回 TOOL_TIMEOUT，得到 ${body.code}`);
expect(slow.gateway.ms >= 30 && slow.gateway.ms < 2000, `耗时应接近超时，得到 ${slow.gateway.ms}`);

const ok = await invokeThroughGateway({
  name: "read_rows",
  grant: ["read"],
  run: async () => ({ content: { rows: 2 } }),
});
expect(!ok.isError && ok.gateway.allowed && ok.gateway.ms >= 1, "获准的读取应执行并记下耗时");
console.log("ok tool-gateway");
