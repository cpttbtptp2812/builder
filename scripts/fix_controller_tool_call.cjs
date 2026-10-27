const fs = require('fs');

const ctrlPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/AgentPlatformController.java';
let content = fs.readFileSync(ctrlPath, 'utf8');

// 修复 toolExecutor.execute 为正确的 executeTool
content = content.replace(
    /toolExecutor\.execute\("validate_iso20022_iban", p\)/g,
    'toolExecutor.executeTool("validate_iso20022_iban", "{\\"iban\\":\\"DE89370400440532013000\\"}", 1).getData()'
);
content = content.replace(
    /toolExecutor\.execute\("calculate_fx_hedging", p\)/g,
    'toolExecutor.executeTool("calculate_fx_hedging", "{\\"notional\\":1000000,\\"currencyPair\\":\\"USD/CNY\\",\\"tenorDays\\":90}", 1).getData()'
);
content = content.replace(
    /toolExecutor\.execute\("query_system_metrics", Collections\.emptyMap\(\)\)/g,
    'toolExecutor.executeTool("query_system_metrics", "{}", 1).getData()'
);

fs.writeFileSync(ctrlPath, content, 'utf8');
console.log('✓ Successfully patched AgentPlatformController.java with executeTool');
