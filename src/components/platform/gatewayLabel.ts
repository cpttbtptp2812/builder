import type { ToolCapability } from "../../lib/platformProtocol";

export function capabilityLabel(capability: ToolCapability): string {
  if (capability === "network") return "访问网络";
  if (capability === "model") return "调用模型";
  if (capability === "write") return "写入数据";
  return "读取材料";
}
