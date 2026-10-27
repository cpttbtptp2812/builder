const fs = require('fs');

// 1. Update AgentPlatformController.java
const controllerPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/AgentPlatformController.java';
let controllerContent = fs.readFileSync(controllerPath, 'utf8');

if (!controllerContent.includes('EMBEDDING_API_KEY')) {
    controllerContent = controllerContent.replace(
        'map.put("EMBEDDING_BASE_URL", llmClientService.getConfig("EMBEDDING_BASE_URL", ""));',
        'map.put("EMBEDDING_BASE_URL", llmClientService.getConfig("EMBEDDING_BASE_URL", ""));\n        map.put("EMBEDDING_API_KEY", llmClientService.getConfig("EMBEDDING_API_KEY", ""));'
    );
    fs.writeFileSync(controllerPath, controllerContent, 'utf8');
    console.log('Updated AgentPlatformController.java with EMBEDDING_API_KEY');
}

// 2. Update HybridRagService.java
const ragPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/HybridRagService.java';
let ragContent = fs.readFileSync(ragPath, 'utf8');

const newVectorEngineBlock = `    // ─────────────────────────────────────────────────────────────
    // 独立可审计的 Dense 向量引擎 (支持真实高维嵌入与数据防污染保护)
    // ─────────────────────────────────────────────────────────────
    public static class VectorEnvelope {
        public final float[] vector;
        public final int dimension;
        public final String model;
        public final boolean isNeuralEmbedding;

        public VectorEnvelope(float[] vector, int dimension, String model, boolean isNeuralEmbedding) {
            this.vector = vector;
            this.dimension = dimension;
            this.model = model;
            this.isNeuralEmbedding = isNeuralEmbedding;
        }
    }

    public static class StoredChunkVector {
        public final String model;
        public final int dim;
        public final boolean isNeural;
        public final float[] vector;

        public StoredChunkVector(String model, int dim, boolean isNeural, float[] vector) {
            this.model = model;
            this.dim = dim;
            this.isNeural = isNeural;
            this.vector = vector;
        }
    }

    private StoredChunkVector parseChunkVector(KnowledgeChunk chunk) {
        if (chunk.getEmbeddingJson() == null || chunk.getEmbeddingJson().isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(chunk.getEmbeddingJson());
            if (root.isObject() && root.has("vector")) {
                String model = root.path("model").asText("unknown");
                boolean isNeural = root.path("is_neural").asBoolean(false);
                JsonNode arr = root.path("vector");
                if (arr.isArray() && arr.size() > 0) {
                    float[] vec = new float[arr.size()];
                    for (int i = 0; i < arr.size(); i++) vec[i] = (float) arr.get(i).asDouble();
                    return new StoredChunkVector(model, arr.size(), isNeural, vec);
                }
            } else if (root.isArray() && root.size() > 0) {
                int size = root.size();
                float[] vec = new float[size];
                for (int i = 0; i < size; i++) vec[i] = (float) root.get(i).asDouble();
                boolean isNeural = size > 256;
                String model = isNeural ? "legacy-neural" : "local-fnv-token-hash";
                return new StoredChunkVector(model, size, isNeural, vec);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private void saveChunkVector(KnowledgeChunk chunk, VectorEnvelope env) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("model", env.model);
            map.put("dim", env.dimension);
            map.put("is_neural", env.isNeuralEmbedding);
            List<Double> rounded = new ArrayList<>(env.vector.length);
            for (float v : env.vector) {
                rounded.add(Math.round(v * 100000.0) / 100000.0);
            }
            map.put("vector", rounded);
            chunk.setEmbeddingJson(objectMapper.writeValueAsString(map));
            knowledgeChunkRepository.save(chunk);
        } catch (Exception ignored) {}
    }

    public VectorEnvelope generateDenseVector(String text) {
        if (text == null || text.isBlank()) {
            return new VectorEnvelope(new float[256], 256, "none", false);
        }

        // 1. 尝试调用配置的真实神经网络 Embedding 模型 (Ollama nomic-embed-text/bge 或 OpenAI)
        try {
            float[] remote = llmClientService.getEmbeddings(text);
            if (remote != null && remote.length > 0) {
                float[] norm = l2Normalize(remote);
                String activeModel = llmClientService.getConfig("EMBEDDING_MODEL", "nomic-embed-text");
                return new VectorEnvelope(norm, norm.length, activeModel, true);
            }
        } catch (Exception ignored) {}

        // 2. 外部无 Embedding 服务时，降级采用 256 维基于 FNV-1a 与三角位置投影的确定性词元哈希向量 (严格命名为 local-fnv-token-hash，绝不冒充语义空间或 SimHash)
        float[] fallback = generateDeterministicHashVector(text, 256);
        return new VectorEnvelope(fallback, 256, "local-fnv-token-hash", false);
    }

    public VectorEnvelope getOrComputeChunkVector(KnowledgeChunk chunk, VectorEnvelope queryEnv) {
        StoredChunkVector stored = parseChunkVector(chunk);
        String fullText = getChunkFullText(chunk);

        // 场景 A: Query 处于离线或无可用 Embedding 服务，降级为 256 维 FNV 词元哈希
        if (!queryEnv.isNeuralEmbedding) {
            // 关键安全防线：若切片库里已有 768/1536 维真实神经向量，绝不能为了这次查询而用 256 维哈希覆盖写坏数据库！
            // 仅在内存临时生成 256 维 FNV 哈希用于本次只读比对，绝不保存到数据库
            float[] tempHash = generateDeterministicHashVector(fullText, 256);
            return new VectorEnvelope(tempHash, 256, "local-fnv-token-hash", false);
        }

        // 场景 B: Query 是真实的神经语义向量 (queryEnv.isNeuralEmbedding == true)
        if (stored != null && stored.isNeural) {
            // 如果切片已有神经向量，且维度与当前查询期望模型一致，直接复用
            if (stored.dim == queryEnv.dimension && (stored.model.equals(queryEnv.model) || "legacy-neural".equals(stored.model))) {
                return new VectorEnvelope(stored.vector, stored.dim, stored.model, true);
            }
        }

        // 场景 C: 切片之前没有向量、或者是旧哈希、或者用户更换了模型维度 (如 768 换成 1536)
        // 尝试在线调用真实 embedding 接口对切片进行重嵌升级
        VectorEnvelope env = generateDenseVector(fullText);
        if (env.isNeuralEmbedding && env.dimension == queryEnv.dimension) {
            // 真实重嵌成功：持久化存入数据库，完成安全自愈与升级
            saveChunkVector(chunk, env);
            return env;
        } else {
            // 关键安全防线：若本次切片在线重嵌失败 (如超时)，坚决不把 256 维哈希覆盖写入已有数据！
            if (stored != null && stored.isNeural) {
                return new VectorEnvelope(stored.vector, stored.dim, stored.model, true);
            }
            return env;
        }
    }

    private String getChunkFullText(KnowledgeChunk chunk) {
        return (chunk.getDocTitle() != null ? chunk.getDocTitle() : "") + " "
                + (chunk.getKeywords() != null ? chunk.getKeywords() : "") + " "
                + (chunk.getContent() != null ? chunk.getContent() : "");
    }`;

// Replace the VectorEnvelope & getOrComputeChunkVector block
const targetRegex = /\/\/ ─────────────────────────────────────────────────────────────[\s\S]*?private float\[\] generateDeterministicHashVector/;

if (targetRegex.test(ragContent)) {
    ragContent = ragContent.replace(targetRegex, newVectorEngineBlock.trim() + '\n\n    private float[] generateDeterministicHashVector');
    
    // Also update hybridSearch chunk loop to pass queryEnv
    ragContent = ragContent.replace(
        'VectorEnvelope chunkEnv = getOrComputeChunkVector(c, queryEnv.dimension, queryEnv.model);',
        'VectorEnvelope chunkEnv = getOrComputeChunkVector(c, queryEnv);'
    );

    // Also update LEXICAL_SIMHASH to LEXICAL_FNV_HASH
    ragContent = ragContent.replace(
        'queryEnv.isNeuralEmbedding ? "NEURAL_EMBEDDING" : "LEXICAL_SIMHASH",',
        'queryEnv.isNeuralEmbedding ? "NEURAL_EMBEDDING" : "LEXICAL_FNV_HASH",'
    );

    fs.writeFileSync(ragPath, ragContent, 'utf8');
    console.log('Successfully updated HybridRagService.java with safe vector envelope');
} else {
    console.error('Could not find target regex in HybridRagService.java');
}
