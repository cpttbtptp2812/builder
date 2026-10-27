const fs = require('fs');

// 1. Update LlmClientService.java
const llmPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/LlmClientService.java';
let llmCode = fs.readFileSync(llmPath, 'utf8');

const testLlmMethod = `
    public Map<String, Object> testLlmConnection(String customBaseUrl, String customApiKey, String customModel) {
        String baseUrl = (customBaseUrl != null && !customBaseUrl.isBlank()) ? customBaseUrl.trim() : getConfig("LLM_BASE_URL", "https://api.deepseek.com/v1");
        String apiKey = (customApiKey != null && !customApiKey.isBlank()) ? customApiKey.trim() : getConfig("LLM_API_KEY", "");
        String model = (customModel != null && !customModel.isBlank()) ? customModel.trim() : getConfig("LLM_MODEL", "deepseek-chat");

        if (!baseUrl.endsWith("/")) baseUrl += "/";
        String endpoint = baseUrl + "chat/completions";

        Map<String, Object> reqBody = Map.of(
            "model", model,
            "messages", List.of(Map.of("role", "user", "content", "hi")),
            "max_tokens", 2,
            "stream", false
        );

        long start = System.currentTimeMillis();
        try {
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(6))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqBody)));

            if (apiKey != null && !apiKey.isBlank() && !apiKey.equals("ollama")) {
                reqBuilder.header("Authorization", "Bearer " + apiKey);
            }

            HttpResponse<String> resp = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            long latency = System.currentTimeMillis() - start;

            if (resp.statusCode() == 200) {
                return Map.of("ok", true, "status", 200, "latencyMs", latency, "msg", "连接成功！大模型端点响应正常 (" + latency + "ms)");
            } else if (resp.statusCode() == 401) {
                return Map.of("ok", false, "status", 401, "msg", "认证失败 (401)：API Key 无效或未授权，请检查密钥是否正确");
            } else if (resp.statusCode() == 404) {
                return Map.of("ok", false, "status", 404, "msg", "端点不存在 (404)：请核对 Base URL 是否正确 (如是否遗漏 /v1)");
            } else {
                return Map.of("ok", false, "status", resp.statusCode(), "msg", "服务商返回 HTTP " + resp.statusCode() + " (请检查模型名 " + model + " 是否受支持)");
            }
        } catch (ConnectException ce) {
            boolean isLocal = endpoint.contains("11434");
            String msg = isLocal
                ? "无法连接到本地 11434 端口。若使用本地 Ollama，请确保已启动 ollama 软件并运行模型；若使用云端服务，请切换至对应供应商并填入 API Key。"
                : "网络连接失败：无法连通目标端点 " + endpoint + "，请检查网络或代理。";
            return Map.of("ok", false, "status", 0, "msg", msg);
        } catch (Exception e) {
            return Map.of("ok", false, "status", 0, "msg", "请求异常：" + e.getMessage());
        }
    }
`;

if (!llmCode.includes('testLlmConnection')) {
    // Insert before the last closing brace
    const lastBrace = llmCode.lastIndexOf('}');
    llmCode = llmCode.slice(0, lastBrace) + testLlmMethod + '\n}\n';
    fs.writeFileSync(llmPath, llmCode, 'utf8');
    console.log('Added testLlmConnection to LlmClientService.java');
}

// 2. Update AgentPlatformController.java
const ctlPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/AgentPlatformController.java';
let ctlCode = fs.readFileSync(ctlPath, 'utf8');

const testLlmEndpoint = `
    @PostMapping("/settings/test-llm")
    public ResponseEntity<Map<String, Object>> testLlmConnection(@RequestBody(required = false) Map<String, String> body) {
        String baseUrl = body != null ? body.get("baseUrl") : null;
        String apiKey = body != null ? body.get("apiKey") : null;
        String model = body != null ? body.get("model") : null;
        Map<String, Object> result = llmClientService.testLlmConnection(baseUrl, apiKey, model);
        return ResponseEntity.ok(result);
    }
`;

if (!ctlCode.includes('/settings/test-llm')) {
    const lastBrace = ctlCode.lastIndexOf('}');
    ctlCode = ctlCode.slice(0, lastBrace) + testLlmEndpoint + '\n}\n';
    fs.writeFileSync(ctlPath, ctlCode, 'utf8');
    console.log('Added /settings/test-llm to AgentPlatformController.java');
}
