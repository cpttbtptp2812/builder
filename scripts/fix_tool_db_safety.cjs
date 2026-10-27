const fs = require('fs');

// 1. Update DatabaseDataInitializer.java
const initPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/config/DatabaseDataInitializer.java';
let initCode = fs.readFileSync(initPath, 'utf8');

initCode = initCode.replace(
  'SELECT * FROM system_config',
  'SELECT id, title, created_at FROM chat_session'
);
fs.writeFileSync(initPath, initCode, 'utf8');
console.log('Updated sample SQL in DatabaseDataInitializer.java');

// 2. Update ToolExecutor.java word-boundary check for safe query keywords
const toolExecPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/ToolExecutor.java';
let toolExecCode = fs.readFileSync(toolExecPath, 'utf8');

const oldCheck = `            if (upper.contains("DROP") || upper.contains("DELETE") || upper.contains("TRUNCATE") || upper.matches(".*\\\\bUPDATE\\\\b.*") || upper.contains("INSERT") || upper.contains("ALTER") || upper.contains("GRANT")) {
                throw new SecurityException("检测到高危修改或删除关键字，安全熔断！");
            }`;

const safeCheck = `            // 仅对独立的 DML/DDL 单词进行严格拦截 (避免 updated_at 字段误报)
            if (upper.matches(".*\\\\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT|ALTER|GRANT|REVOKE|FLUSH)\\\\b.*")) {
                throw new SecurityException("【高危拦截】仅支持只读 SELECT 查询，严禁执行修改、删除或提权指令！");
            }`;

if (toolExecCode.includes('upper.contains("DROP")')) {
  const startIdx = toolExecCode.indexOf('if (upper.contains("DROP")');
  const endIdx = toolExecCode.indexOf('}', startIdx) + 1;
  toolExecCode = toolExecCode.substring(0, startIdx) + safeCheck + toolExecCode.substring(endIdx);
  fs.writeFileSync(toolExecPath, toolExecCode, 'utf8');
  console.log('Updated DDL/DML keyword safety boundary in ToolExecutor.java');
}
