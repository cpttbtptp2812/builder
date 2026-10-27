const fs = require('fs');

const llmPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/LlmClientService.java';
let llmCode = fs.readFileSync(llmPath, 'utf8');

const targetCatchBlock = `        } catch (ConnectException ce) {
            String hint;
            if (isLocalOllama) {
                hint = "【Ollama 本地服务连接失败】无法连接至端口: " + endpoint + "\\n\\n"
                     + "💡 原因分析：当前选择的渠道是【Ollama 本地私有服务】，系统尝试连接本地 11434 端口，但本机未启动 Ollama 软件。\\n\\n"
                     + "👉 快速解决：\\n"
                     + "• 如果您拥有云端大模型的 API Key（如 DeepSeek 官方或硅基流动 key）：\\n"
                     + "  请点击左侧导航【模型与环境配置】，切换为【DeepSeek (官方直连)】或【SiliconFlow】，填入您的 API Key 并点击保存即可直接对话！\\n"
                     + "• 如果您打算使用本地 Ollama：\\n"
                     + "  请在电脑终端执行 \`ollama serve\` 启动服务，并拉取模型：\`ollama run " + model + "\`。";
            } else {
                hint = "【大模型端点连接失败】无法连接至端点: " + endpoint + "\\n\\n请检查网络连接、服务商端点 URL 是否正确，或前往【模型与环境配置】重新核对。";
            }
            onDelta.accept(hint);
            return;
        }

        if (response.statusCode() != 200) {
            onDelta.accept("【大模型接口返回异常 HTTP " + response.statusCode() + "】\\n"
                + "请求模型: " + model + "\\n"
                + "请求端点: " + endpoint + "\\n\\n"
                + "💡 可能原因：\\n"
                + "1. API Key 无效或额度不足 (401/402)\\n"
                + "2. 模型名称在目标服务商不存在 (404)\\n"
                + "请前往【模型与环境配置】核对您的 API Key 与模型名称。");
            return;
        }`;

const catchRegex = /\} catch \(ConnectException ce\)[\s\S]*?if \(response\.statusCode\(\) != 200\) \{[\s\S]*?return;\s*\}/;
if (catchRegex.test(llmCode)) {
    llmCode = llmCode.replace(catchRegex, targetCatchBlock);
    fs.writeFileSync(llmPath, llmCode, 'utf8');
    console.log('Fixed streamChat error messages in LlmClientService.java');
} else {
    console.error('Could not match catch block in LlmClientService.java');
}
