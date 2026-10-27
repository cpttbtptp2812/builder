const fs = require('fs');
const p = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/LlmClientService.java';
let code = fs.readFileSync(p, 'utf8');

const target = `            if (resp.statusCode() == 200) {
                return Map.of("ok", true, "status", 200, "latencyMs", latency, "msg", "连接成功！大模型端点响应正常 (" + latency + "ms)");
            } else if (resp.statusCode() == 401) {
                return Map.of("ok", false, "status", 401, "msg", "认证失败 (401)：API Key 无效或未授权，请检查密钥是否正确");
            } else if (resp.statusCode() == 404) {
                return Map.of("ok", false, "status", 404, "msg", "端点不存在 (404)：请核对 Base URL 是否正确 (如是否遗漏 /v1)");
            } else {
                return Map.of("ok", false, "status", resp.statusCode(), "msg", "服务商返回 HTTP " + resp.statusCode() + " (请检查模型名 " + model + " 是否受支持)");
            }`;

const replacement = `            if (resp.statusCode() == 200) {
                return Map.of("ok", true, "status", 200, "latencyMs", latency, "msg", "连接成功！大模型响应正常 (" + latency + "ms)");
            } else {
                String detail = resp.body() != null ? resp.body() : "";
                try {
                    com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(detail);
                    if (node.has("error")) {
                        com.fasterxml.jackson.databind.JsonNode errNode = node.get("error");
                        if (errNode.isObject() && errNode.has("message")) {
                            detail = errNode.get("message").asText();
                        } else if (errNode.isTextual()) {
                            detail = errNode.asText();
                        }
                    }
                } catch (Exception ignored) {}
                String tip = "服务商返回 HTTP " + resp.statusCode() + ": " + detail;
                return Map.of("ok", false, "status", resp.statusCode(), "msg", tip, "detail", detail);
            }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(p, code, 'utf8');
    console.log('Successfully updated testLlmConnection error parsing');
} else {
    console.log('Target block not found');
}
