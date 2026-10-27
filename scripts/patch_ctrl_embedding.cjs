const fs = require('fs');

const ctrlPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/AgentPlatformController.java';
let content = fs.readFileSync(ctrlPath, 'utf8');

const target = `map.put("LLM_REMOTE_IP", llmClientService.getConfig("LLM_REMOTE_IP", "192.168.1.100"));`;
const replacement = `map.put("LLM_REMOTE_IP", llmClientService.getConfig("LLM_REMOTE_IP", "192.168.1.100"));
        map.put("EMBEDDING_MODEL", llmClientService.getConfig("EMBEDDING_MODEL", "nomic-embed-text"));
        map.put("EMBEDDING_BASE_URL", llmClientService.getConfig("EMBEDDING_BASE_URL", ""));`;

if (content.includes(target) && !content.includes('EMBEDDING_MODEL')) {
    content = content.replace(target, replacement);
    fs.writeFileSync(ctrlPath, content, 'utf8');
    console.log('Added EMBEDDING_MODEL to AgentPlatformController.java');
}
