const fs = require('fs');

// 1. Update AgentPlatformController.java to add @GetMapping("/chat/messages")
const ctlPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/AgentPlatformController.java';
let ctlCode = fs.readFileSync(ctlPath, 'utf8');

const newMapping = `    @GetMapping("/chat/sessions/{id}/messages")
    public List<ChatMessageEntity> getSessionMessages(@PathVariable String id) {
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(id);
    }

    @GetMapping("/chat/messages")
    public List<ChatMessageEntity> getMessagesByQuery(@RequestParam(name = "sessionId", required = false) String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return Collections.emptyList();
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }`;

if (!ctlCode.includes('@GetMapping("/chat/messages")')) {
    ctlCode = ctlCode.replace(
        `    @GetMapping("/chat/sessions/{id}/messages")\n    public List<ChatMessageEntity> getSessionMessages(@PathVariable String id) {\n        return messageRepository.findBySessionIdOrderByCreatedAtAsc(id);\n    }`,
        newMapping
    );
    fs.writeFileSync(ctlPath, ctlCode, 'utf8');
    console.log('Added @GetMapping("/chat/messages") to AgentPlatformController.java');
}

// 2. Update LlmClientService.java to handle model selection on ollama.com
const llmPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/LlmClientService.java';
let llmCode = fs.readFileSync(llmPath, 'utf8');

const targetModelLogic = `        String configuredBaseUrl = getConfig("LLM_BASE_URL", "https://ollama.com/v1");
        String configuredModel = getConfig("LLM_MODEL", "gemma4:31b-cloud");
        String apiKey = getConfig("LLM_API_KEY", getConfig("DEEPSEEK_API_KEY", ""));

        boolean isLocalOllama = configuredBaseUrl.contains("11434");
        boolean isOllamaCloud = configuredBaseUrl.contains("ollama.com");

        // 智能模型对齐：如果在 ollama.com 云端，但传入了仅在本地运行的旧模型名 deepseek-r1:8b，自动校正为云端支持的模型
        String model;
        if (isOllamaCloud && (customModel == null || customModel.isBlank() || customModel.equals("deepseek-r1:8b") || customModel.equals("deepseek-chat"))) {
            model = configuredModel;
        } else if (customModel != null && !customModel.isBlank() && !customModel.equals("deepseek-chat")) {
            model = customModel;
        } else {
            model = configuredModel;
        }`;

const oldModelRegex = /String configuredBaseUrl = getConfig\("LLM_BASE_URL"[\s\S]*?String model = isLocalOllama \? configuredModel : \(customModel != null && !customModel\.isBlank\(\) \? customModel : configuredModel\);/;
if (oldModelRegex.test(llmCode)) {
    llmCode = llmCode.replace(oldModelRegex, targetModelLogic);
    fs.writeFileSync(llmPath, llmCode, 'utf8');
    console.log('Updated model alignment in LlmClientService.java');
}

// 3. Update SettingsPage.tsx for Ollama Cloud default model to gemma4:31b-cloud
const settingsPath = 'e:/owner/builder/src/pages/settings/SettingsPage.tsx';
let settingsCode = fs.readFileSync(settingsPath, 'utf8');

settingsCode = settingsCode.replace('defaultModel: "deepseek-r1:8b"', 'defaultModel: "gemma4:31b-cloud"');
settingsCode = settingsCode.replace(
    'models: ["deepseek-r1:8b", "deepseek-r1:70b"',
    'models: ["gemma4:31b-cloud", "deepseek-v4.1-flash", "glm-5.3-flash", "kimi-k3"'
);
settingsCode = settingsCode.replace(
    'const [modelName, setModelName] = useState("deepseek-r1:8b");',
    'const [modelName, setModelName] = useState("gemma4:31b-cloud");'
);

fs.writeFileSync(settingsPath, settingsCode, 'utf8');
console.log('Updated SettingsPage.tsx for gemma4:31b-cloud');
