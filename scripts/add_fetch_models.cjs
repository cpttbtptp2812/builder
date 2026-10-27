const fs = require('fs');

// 1. Update LlmClientService.java with fetchRemoteModels
const servicePath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/LlmClientService.java';
let serviceCode = fs.readFileSync(servicePath, 'utf8');

const fetchModelsMethod = `
    public Map<String, Object> fetchRemoteModels(String customBaseUrl, String customApiKey) {
        String baseUrl = (customBaseUrl != null && !customBaseUrl.isBlank()) ? customBaseUrl.trim() : getConfig("LLM_BASE_URL", "https://api.deepseek.com/v1");
        String apiKey = (customApiKey != null && !customApiKey.isBlank()) ? customApiKey.trim() : getConfig("LLM_API_KEY", "");

        if (!baseUrl.endsWith("/")) baseUrl += "/";
        String endpoint = baseUrl + "models";

        try {
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(6))
                    .GET();

            if (apiKey != null && !apiKey.isBlank() && !apiKey.equals("ollama")) {
                reqBuilder.header("Authorization", "Bearer " + apiKey);
            }

            HttpResponse<String> resp = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() == 200) {
                com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(resp.body());
                List<String> modelList = new java.util.ArrayList<>();
                if (root.has("data") && root.get("data").isArray()) {
                    for (com.fasterxml.jackson.databind.JsonNode item : root.get("data")) {
                        if (item.has("id")) {
                            modelList.add(item.get("id").asText());
                        }
                    }
                } else if (root.has("models") && root.get("models").isArray()) {
                    for (com.fasterxml.jackson.databind.JsonNode item : root.get("models")) {
                        if (item.has("name")) {
                            modelList.add(item.get("name").asText());
                        } else if (item.has("id")) {
                            modelList.add(item.get("id").asText());
                        }
                    }
                }
                return Map.of("ok", true, "count", modelList.size(), "models", modelList, "msg", "成功拉取到 " + modelList.size() + " 个最新可用模型");
            } else {
                String detail = resp.body() != null ? resp.body() : "";
                try {
                    com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(detail);
                    if (node.has("error") && node.get("error").has("message")) {
                        detail = node.get("error").get("message").asText();
                    }
                } catch (Exception ignored) {}
                return Map.of("ok", false, "status", resp.statusCode(), "msg", "拉取失败 HTTP " + resp.statusCode() + ": " + detail);
            }
        } catch (Exception e) {
            return Map.of("ok", false, "msg", "无法拉取模型列表: " + e.getMessage());
        }
    }
`;

if (!serviceCode.includes('fetchRemoteModels')) {
    const lastBrace = serviceCode.lastIndexOf('}');
    serviceCode = serviceCode.slice(0, lastBrace) + fetchModelsMethod + '\n}\n';
    fs.writeFileSync(servicePath, serviceCode, 'utf8');
    console.log('Added fetchRemoteModels to LlmClientService.java');
}

// 2. Update AgentPlatformController.java
const ctlPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/AgentPlatformController.java';
let ctlCode = fs.readFileSync(ctlPath, 'utf8');

const fetchModelsEndpoint = `
    @PostMapping("/settings/fetch-models")
    public ResponseEntity<Map<String, Object>> fetchModels(@RequestBody(required = false) Map<String, String> body) {
        String baseUrl = body != null ? body.get("baseUrl") : null;
        String apiKey = body != null ? body.get("apiKey") : null;
        Map<String, Object> result = llmClientService.fetchRemoteModels(baseUrl, apiKey);
        return ResponseEntity.ok(result);
    }
`;

if (!ctlCode.includes('/settings/fetch-models')) {
    const lastBrace = ctlCode.lastIndexOf('}');
    ctlCode = ctlCode.slice(0, lastBrace) + fetchModelsEndpoint + '\n}\n';
    fs.writeFileSync(ctlPath, ctlCode, 'utf8');
    console.log('Added /settings/fetch-models to AgentPlatformController.java');
}
