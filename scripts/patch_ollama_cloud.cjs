const fs = require('fs');

// 1. Update SettingsPage.tsx
const settingsPath = 'e:/owner/builder/src/pages/settings/SettingsPage.tsx';
let settingsCode = fs.readFileSync(settingsPath, 'utf8');

const newPresets = `const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "ollama-cloud",
    name: "Ollama Cloud (官方云端直连) · 推荐",
    badge: "ollama.com/dashboard 官方 Key",
    baseUrl: "https://ollama.com/v1",
    defaultModel: "deepseek-r1:8b",
    models: [
      "deepseek-r1:8b",
      "deepseek-r1:70b",
      "deepseek-r1:32b",
      "deepseek-r1:14b",
      "qwen2.5:72b",
      "qwen2.5:14b",
      "qwen2.5:7b",
      "llama3.3",
      "mistral",
    ],
    keyPlaceholder: "在此粘贴您在 https://ollama.com/dashboard 复制的 API Key",
    keyGuideUrl: "https://ollama.com/settings/keys",
    keyGuideText: "点击打开 ollama.com/dashboard 获取 Key",
    description: "直连 Ollama 官方云端端点 (https://ollama.com/v1)，填入您在 Dashboard 复制的 Key 即可极速对话，无需本地显卡与软件！",
    isLocal: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek (官方直连)",
    badge: "国内官方 · 填 Key 即用",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://platform.deepseek.com/api_keys",
    keyGuideText: "在 DeepSeek 开放平台创建 API Key",
    description: "国内顶级大模型，性价比极高，支持 V3 极速推理与 R1 深度思考",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow (硅基流动)",
    badge: "国产云算力 · 注册送额度",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    models: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "Qwen/Qwen2.5-Coder-32B-Instruct",
    ],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://cloud.siliconflow.cn/account/ak",
    keyGuideText: "在硅基流动控制台获取 API Key",
    description: "国内高可用云算力中转，免本地显卡直接体验 DeepSeek 全规格模型",
  },
  {
    id: "openai",
    name: "OpenAI (官方 / 代理)",
    badge: "国际标准 · GPT-4o / o3",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1"],
    keyPlaceholder: "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideUrl: "https://platform.openai.com/api-keys",
    keyGuideText: "在 OpenAI 开发者控制台获取",
    description: "OpenAI 官方 API 或企业中转网关端点，支持全系列前沿多模态大模型",
  },
  {
    id: "ollama-local",
    name: "Ollama (电脑本地安装版 / 11434)",
    badge: "本地离线 · 免 API Key",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "deepseek-r1:8b",
    models: [
      "deepseek-r1:8b",
      "deepseek-r1:70b",
      "qwen2.5:72b",
      "qwen2.5:14b",
      "qwen2.5:7b",
      "llama3.3",
      "mistral",
    ],
    keyPlaceholder: "本地部署免密，填 ollama 即可",
    keyGuideText: "需要本机安装 Ollama 软件并执行 ollama serve",
    description: "通过本机显卡运行开源模型（需本地已启动 ollama 软件并监听 11434 端口）",
    isLocal: true,
  },
  {
    id: "custom",
    name: "自定义端点 (第三方中转 / 私有网关)",
    badge: "任何 OpenAI 兼容接口",
    baseUrl: "https://api.your-relay.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "deepseek-chat", "claude-3-5-sonnet-20241022"],
    keyPlaceholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    keyGuideText: "支持第三方聚合平台、OneAPI 或企业自建反向代理",
    description: "支持任意标准的 OpenAI 兼容 Base URL 与自定义 API Key",
  },
];`;

const presetRegex = /const PROVIDER_PRESETS: ProviderPreset\[\] = \[[\s\S]*?\];/;
if (presetRegex.test(settingsCode)) {
    settingsCode = settingsCode.replace(presetRegex, newPresets);
    
    // Also default selectedProviderId to ollama-cloud
    settingsCode = settingsCode.replace(
        'const [selectedProviderId, setSelectedProviderId] = useState<string>("deepseek");',
        'const [selectedProviderId, setSelectedProviderId] = useState<string>("ollama-cloud");'
    );
    settingsCode = settingsCode.replace(
        'const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");',
        'const [baseUrl, setBaseUrl] = useState("https://ollama.com/v1");'
    );
    settingsCode = settingsCode.replace(
        'const [modelName, setModelName] = useState("deepseek-chat");',
        'const [modelName, setModelName] = useState("deepseek-r1:8b");'
    );

    // Also update baseUrl matching in useEffect
    const matchBlock = `        if (data.LLM_BASE_URL) {
          setBaseUrl(data.LLM_BASE_URL);
          if (data.LLM_BASE_URL.includes("ollama.com")) {
            setSelectedProviderId("ollama-cloud");
          } else if (data.LLM_BASE_URL.includes("11434")) {
            setSelectedProviderId("ollama-local");
          } else {
            const matched = PROVIDER_PRESETS.find(
              (p) =>
                data.LLM_BASE_URL.toLowerCase().includes(p.id) ||
                p.baseUrl.toLowerCase() === data.LLM_BASE_URL.toLowerCase()
            );
            if (matched) setSelectedProviderId(matched.id);
            else setSelectedProviderId("custom");
          }
        }`;
    const targetMatchRegex = /if \(data\.LLM_BASE_URL\) \{[\s\S]*?setSelectedProviderId\("custom"\);\s*\}\s*\}/;
    if (targetMatchRegex.test(settingsCode)) {
        settingsCode = settingsCode.replace(targetMatchRegex, matchBlock);
    }

    fs.writeFileSync(settingsPath, settingsCode, 'utf8');
    console.log('Successfully updated SettingsPage.tsx with Ollama Cloud');
} else {
    console.error('Could not find PROVIDER_PRESETS in SettingsPage.tsx');
}

// 2. Update ChatPlaygroundPage.tsx
const chatPath = 'e:/owner/builder/src/pages/chat/ChatPlaygroundPage.tsx';
let chatCode = fs.readFileSync(chatPath, 'utf8');

const targetProviderLabel = `  const getProviderLabel = (url: string) => {
    const u = (url || "").toLowerCase();
    if (u.includes("ollama.com")) return "Ollama 官方云端";
    if (u.includes("11434")) return "本地/私有 Ollama";
    if (u.includes("deepseek.com")) return "DeepSeek 官方";
    if (u.includes("siliconflow.cn")) return "SiliconFlow 硅基流动";
    if (u.includes("openai.com")) return "OpenAI 官方";
    if (u.includes("dashscope.aliyuncs.com")) return "阿里百炼";
    if (u.includes("moonshot.cn")) return "月之暗面 Kimi";
    return "自建/中转端点";
  };`;

const providerLabelRegex = /const getProviderLabel = \(url: string\) => \{[\s\S]*?return "自建\/中转端点";\s*\};/;
if (providerLabelRegex.test(chatCode)) {
    chatCode = chatCode.replace(providerLabelRegex, targetProviderLabel);
    fs.writeFileSync(chatPath, chatCode, 'utf8');
    console.log('Successfully updated ChatPlaygroundPage.tsx with Ollama 官方云端');
}
