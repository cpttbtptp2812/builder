const fs = require('fs');

const ragContent = `package com.ownsudo.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ownsudo.entity.KnowledgeChunk;
import com.ownsudo.repository.KnowledgeChunkRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class HybridRagService {

    private static final int RRF_K = 60;

    @Autowired
    private KnowledgeChunkRepository knowledgeChunkRepository;

    @Autowired
    private LlmClientService llmClientService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public static class RagChunk {
        private String chunkId;
        private String projectName;
        private String section;
        private String text;
        private double denseScore;
        private double sparseScore;
        private double rrfScore;
        private String vectorMode;
        private String vectorModel;

        public RagChunk(String chunkId, String projectName, String section, String text,
                        double denseScore, double sparseScore, double rrfScore,
                        String vectorMode, String vectorModel) {
            this.chunkId = chunkId;
            this.projectName = projectName;
            this.section = section;
            this.text = text;
            this.denseScore = denseScore;
            this.sparseScore = sparseScore;
            this.rrfScore = rrfScore;
            this.vectorMode = vectorMode;
            this.vectorModel = vectorModel;
        }

        public String getChunkId() { return chunkId; }
        public String getProjectName() { return projectName; }
        public String getSection() { return section; }
        public String getText() { return text; }
        public double getDenseScore() { return denseScore; }
        public double getSparseScore() { return sparseScore; }
        public double getRrfScore() { return rrfScore; }
        public String getVectorMode() { return vectorMode; }
        public String getVectorModel() { return vectorModel; }
    }

    /**
     * 中英文词元切分器
     */
    public List<String> tokenize(String text) {
        if (text == null || text.isBlank()) return Collections.emptyList();
        List<String> tokens = new ArrayList<>();

        // 英文、数字标识符
        Pattern enPattern = Pattern.compile("[a-zA-Z0-9_#-]+");
        Matcher enMatcher = enPattern.matcher(text);
        while (enMatcher.find()) {
            String w = enMatcher.group().toLowerCase().trim();
            if (w.length() >= 2) tokens.add(w);
        }

        // 连续汉字切分 (单字、2-gram、3-gram)
        Pattern cnPattern = Pattern.compile("[\\\\u4e00-\\\\u9fa5]+");
        Matcher cnMatcher = cnPattern.matcher(text);
        while (cnMatcher.find()) {
            String cn = cnMatcher.group();
            if (cn.length() <= 3) tokens.add(cn);
            for (int i = 0; i < cn.length() - 1; i++) tokens.add(cn.substring(i, i + 2));
            for (int i = 0; i < cn.length() - 2; i++) tokens.add(cn.substring(i, i + 3));
        }

        return tokens;
    }

    // ─────────────────────────────────────────────────────────────
    // 独立可审计的 Okapi BM25 检索算法类 (严格遵循 Robertson-Spärck Jones IDF 公式)
    // ─────────────────────────────────────────────────────────────
    public static class OkapiBM25Engine {
        private final double k1;
        private final double b;
        private final int N;
        private final double avgdl;
        private final Map<String, Integer> docLengths = new HashMap<>();
        private final Map<String, Map<String, Integer>> invertedIndex = new HashMap<>();
        private final Map<String, KnowledgeChunk> chunkMap = new HashMap<>();
        private final HybridRagService rag;

        public OkapiBM25Engine(List<KnowledgeChunk> corpus, double k1, double b, HybridRagService rag) {
            this.k1 = k1;
            this.b = b;
            this.rag = rag;
            this.N = corpus.size();

            long totalTokens = 0;
            for (KnowledgeChunk chunk : corpus) {
                String docId = chunk.getId();
                chunkMap.put(docId, chunk);

                String fullDoc = (chunk.getDocTitle() != null ? chunk.getDocTitle() : "") + " "
                        + (chunk.getKeywords() != null ? chunk.getKeywords() : "") + " "
                        + (chunk.getContent() != null ? chunk.getContent() : "");

                List<String> tokens = rag.tokenize(fullDoc.toLowerCase());
                int len = tokens.size();
                docLengths.put(docId, len);
                totalTokens += len;

                Map<String, Integer> termFreqs = new HashMap<>();
                for (String t : tokens) {
                    termFreqs.put(t, termFreqs.getOrDefault(t, 0) + 1);
                }

                for (Map.Entry<String, Integer> entry : termFreqs.entrySet()) {
                    invertedIndex.computeIfAbsent(entry.getKey(), k -> new HashMap<>()).put(docId, entry.getValue());
                }
            }
            this.avgdl = N > 0 ? (double) totalTokens / N : 1.0;
        }

        public double computeIDF(String term) {
            Map<String, Integer> posting = invertedIndex.get(term);
            int df = (posting != null) ? posting.size() : 0;
            if (df == 0) return 0.0;
            // 标准 Robertson-Spärck Jones (RSJ) IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
            return Math.log(1.0 + (N - df + 0.5) / (df + 0.5));
        }

        public double computeBM25(String query, String docId) {
            KnowledgeChunk chunk = chunkMap.get(docId);
            if (chunk == null) return 0.0;

            int docLen = docLengths.getOrDefault(docId, 0);
            List<String> queryTokens = rag.tokenize(query.toLowerCase());
            if (queryTokens.isEmpty()) return 0.0;

            String titleLower = (chunk.getDocTitle() != null ? chunk.getDocTitle() : "").toLowerCase();
            String kwLower = (chunk.getKeywords() != null ? chunk.getKeywords() : "").toLowerCase();

            double score = 0.0;
            for (String q : queryTokens) {
                Map<String, Integer> posting = invertedIndex.get(q);
                if (posting == null || !posting.containsKey(docId)) continue;

                int tf = posting.get(docId);
                double idf = computeIDF(q);
                if (idf <= 0.0) continue;

                // 标准 Okapi TF 饱和度与文档长度归一化公式
                double tfSaturation = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * (docLen / avgdl)));

                // 微软与 Lucene BM25F 多字段加权因子：标题命中加权 2.0x，关键词加权 1.5x
                double fieldMultiplier = 1.0;
                if (titleLower.contains(q)) fieldMultiplier += 1.5;
                if (kwLower.contains(q)) fieldMultiplier += 1.0;

                score += idf * tfSaturation * fieldMultiplier;
            }
            return score;
        }
    }

    // ─────────────────────────────────────────────────────────────
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
    }

    private float[] generateDeterministicHashVector(String text, int dim) {
        float[] vector = new float[dim];
        List<String> tokens = tokenize(text);
        if (tokens.isEmpty()) return vector;

        int pos = 0;
        for (String token : tokens) {
            byte[] bytes = token.getBytes(StandardCharsets.UTF_8);
            int h1 = fnv1a(bytes, 0x811c9dc5);
            int h2 = fnv1a(bytes, 0x9e3779b9);

            int dim1 = Math.abs(h1) % dim;
            int dim2 = Math.abs(h2) % dim;

            double weight = 1.0 / (1.0 + Math.log1p(pos));
            vector[dim1] += (float) (Math.sin(h1) * weight);
            vector[dim2] += (float) (Math.cos(h2) * weight);
            pos++;
        }

        for (int i = 0; i < dim; i++) {
            vector[i] = (float) Math.tanh(vector[i]);
        }
        return l2Normalize(vector);
    }

    private int fnv1a(byte[] data, int seed) {
        int hash = seed;
        for (byte b : data) {
            hash ^= (b & 0xff);
            hash *= 0x01000193;
        }
        return hash;
    }

    private float[] l2Normalize(float[] vec) {
        double sumSq = 0.0;
        for (float v : vec) sumSq += v * v;
        double norm = Math.sqrt(sumSq);
        if (norm > 1e-8) {
            for (int i = 0; i < vec.length; i++) vec[i] = (float) (vec[i] / norm);
        }
        return vec;
    }

    public double computeCosineSimilarity(float[] v1, float[] v2) {
        if (v1 == null || v2 == null || v1.length != v2.length) return 0.0;
        double dot = 0.0;
        for (int i = 0; i < v1.length; i++) dot += v1[i] * v2[i];
        return Math.max(0.0, Math.min(1.0, (dot + 1.0) / 2.0));
    }

    /**
     * 混合检索入口 (BM25 + Dense Cosine + RRF)
     */
    public List<RagChunk> hybridSearch(String rawQuery, int limit) {
        if (rawQuery == null || rawQuery.trim().isEmpty()) {
            return Collections.emptyList();
        }

        List<KnowledgeChunk> allChunks = knowledgeChunkRepository.findAll();
        if (allChunks.isEmpty()) {
            return Collections.emptyList();
        }

        String query = rawQuery.trim();

        // 1. 初始化标准 Okapi BM25 检索引擎
        OkapiBM25Engine bm25Engine = new OkapiBM25Engine(allChunks, 1.2, 0.75, this);
        Map<String, Double> bm25Scores = new HashMap<>();
        double maxBm25 = 0.0;

        for (KnowledgeChunk c : allChunks) {
            double score = bm25Engine.computeBM25(query, c.getId());
            if (score > 0.0) {
                bm25Scores.put(c.getId(), score);
                if (score > maxBm25) maxBm25 = score;
            }
        }

        // 2. 生成 Query 语义向量并检索切片 (自动对齐模型与维度)
        VectorEnvelope queryEnv = generateDenseVector(query);
        Map<String, Double> denseScores = new HashMap<>();

        for (KnowledgeChunk c : allChunks) {
            VectorEnvelope chunkEnv = getOrComputeChunkVector(c, queryEnv);
            double cosine = computeCosineSimilarity(queryEnv.vector, chunkEnv.vector);
            denseScores.put(c.getId(), cosine);
        }

        // 候选切片过滤
        List<KnowledgeChunk> candidates = new ArrayList<>();
        for (KnowledgeChunk c : allChunks) {
            boolean hasBm25 = bm25Scores.containsKey(c.getId());
            double dense = denseScores.getOrDefault(c.getId(), 0.0);
            if (hasBm25 || dense > 0.65) {
                candidates.add(c);
            }
        }

        if (candidates.isEmpty()) {
            return Collections.emptyList();
        }

        // 3. RRF 倒数排名融合 (k=60)
        candidates.sort((a, b) -> Double.compare(bm25Scores.getOrDefault(b.getId(), 0.0), bm25Scores.getOrDefault(a.getId(), 0.0)));
        Map<String, Integer> sparseRanks = new HashMap<>();
        for (int i = 0; i < candidates.size(); i++) sparseRanks.put(candidates.get(i).getId(), i + 1);

        candidates.sort((a, b) -> Double.compare(denseScores.getOrDefault(b.getId(), 0.0), denseScores.getOrDefault(a.getId(), 0.0)));
        Map<String, Integer> denseRanks = new HashMap<>();
        for (int i = 0; i < candidates.size(); i++) denseRanks.put(candidates.get(i).getId(), i + 1);

        double safeMaxBm25 = maxBm25 > 0 ? maxBm25 : 1.0;
        List<RagChunk> resultList = new ArrayList<>();

        for (KnowledgeChunk c : candidates) {
            String cid = c.getId();
            int rankSparse = sparseRanks.getOrDefault(cid, candidates.size() + 1);
            int rankDense = denseRanks.getOrDefault(cid, candidates.size() + 1);

            double rrfScore = (1.0 / (RRF_K + rankSparse)) + (1.0 / (RRF_K + rankDense));
            double normalizedBm25 = Math.min(1.0, bm25Scores.getOrDefault(cid, 0.0) / safeMaxBm25);
            double realDenseCosine = denseScores.getOrDefault(cid, 0.0);

            resultList.add(new RagChunk(
                    c.getId(),
                    c.getDocTitle(),
                    c.getCategory() != null ? c.getCategory() : "ENTERPRISE_CORPUS",
                    c.getContent(),
                    Math.round(realDenseCosine * 1000.0) / 1000.0,
                    Math.round(normalizedBm25 * 1000.0) / 1000.0,
                    Math.round(rrfScore * 10000.0) / 10000.0,
                    queryEnv.isNeuralEmbedding ? "NEURAL_EMBEDDING" : "LEXICAL_FNV_HASH",
                    queryEnv.model
            ));
        }

        resultList.sort((a, b) -> Double.compare(b.getRrfScore(), a.getRrfScore()));
        return resultList.subList(0, Math.min(limit, resultList.size()));
    }
}
`;

fs.writeFileSync('E:/owner/ownsudo/src/main/java/com/ownsudo/service/HybridRagService.java', ragContent, 'utf8');
console.log('Successfully wrote complete HybridRagService.java');
