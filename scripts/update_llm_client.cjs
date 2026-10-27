const fs = require('fs');

// 1. Update LlmClientService.java
const llmPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/LlmClientService.java';
let llmContent = fs.readFileSync(llmPath, 'utf8');

const targetGetEmbeddings = `    public float[] getEmbeddings(String text) {
        if (text == null || text.isBlank()) return null;

        String configuredEmbedBase = getConfig("EMBEDDING_BASE_URL", "").trim();
        String llmBase = getConfig("LLM_BASE_URL", "http://localhost:11434/v1").trim();

        String targetBaseUrl;
        if (!configuredEmbedBase.isEmpty()) {
            targetBaseUrl = configuredEmbedBase;
        } else {
            // 关键保护：若 LLM_BASE_URL 是 DeepSeek 等无 embedding 接口的纯对话服务商，坚决不打向 deepseek.com/v1/embeddings
            if (llmBase.toLowerCase().contains("deepseek.com")) {
                // 自动解耦并回退至本地 Ollama 专用端点，避免 404
                targetBaseUrl = "http://localhost:11434/v1";
            } else {
                targetBaseUrl = llmBase;
            }
        }

        String embedModel = getConfig("EMBEDDING_MODEL", "").trim();
        if (embedModel.isEmpty()) {
            if (targetBaseUrl.contains("openai.com")) {
                embedModel = "text-embedding-3-small";
            } else if (targetBaseUrl.contains("siliconflow.cn")) {
                embedModel = "BAAI/bge-m3";
            } else {
                embedModel = "nomic-embed-text";
            }
        }

        String apiKey = getConfig("EMBEDDING_API_KEY", "").trim();
        if (apiKey.isEmpty()) {
            if (targetBaseUrl.contains("11434")) {
                apiKey = "ollama";
            } else {
                apiKey = getConfig("LLM_API_KEY", getConfig("DEEPSEEK_API_KEY", ""));
            }
        }

        try {
            String baseUrl = targetBaseUrl;
            if (!baseUrl.endsWith("/")) baseUrl += "/";
            String endpoint = baseUrl + "embeddings";

            Map<String, Object> reqBody = Map.of(
                "model", embedModel,
                "input", text
            );

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(4))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqBody)));

            if (apiKey != null && !apiKey.isBlank()) {
                reqBuilder.header("Authorization", "Bearer " + apiKey);
            }

            HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode data = root.path("data");
                if (data.isArray() && data.size() > 0) {
                    JsonNode embNode = data.get(0).path("embedding");
                    if (embNode.isArray() && embNode.size() > 0) {
                        float[] vector = new float[embNode.size()];
                        for (int i = 0; i < embNode.size(); i++) {
                            vector[i] = (float) embNode.get(i).asDouble();
                        }
                        return vector;
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }`;

// Replace getEmbeddings block in LlmClientService.java
const getEmbeddingsRegex = /public float\[\] getEmbeddings[\s\S]*?return null;\s*\}/;
if (getEmbeddingsRegex.test(llmContent)) {
    llmContent = llmContent.replace(getEmbeddingsRegex, targetGetEmbeddings.trim());
    fs.writeFileSync(llmPath, llmContent, 'utf8');
    console.log('Successfully updated LlmClientService.java');
} else {
    console.error('Could not find getEmbeddings in LlmClientService.java');
}
