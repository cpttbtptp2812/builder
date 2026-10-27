const fs = require('fs');
const p = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/ToolExecutor.java';
let code = fs.readFileSync(p, 'utf8');

const target = `            if (upper.contains("DROP") || upper.contains("DELETE") || upper.contains("TRUNCATE") || upper.contains("UPDATE") || upper.contains("INSERT")) {
                throw new SecurityException("检测到高危修改或删除关键字，安全熔断！");
            }
            if (jdbcTemplate != null) {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("querySql", sql);
                result.put("rowCount", rows.size());
                result.put("rows", rows.size() > 50 ? rows.subList(0, 50) : rows);
                return result;
            }`;

const replacement = `            if (upper.contains("DROP") || upper.contains("DELETE") || upper.contains("TRUNCATE") || upper.contains("UPDATE") || upper.contains("INSERT") || upper.contains("ALTER") || upper.contains("GRANT")) {
                throw new SecurityException("检测到高危修改或删除关键字，安全熔断！");
            }
            // 敏感凭证与核心配置表白名单/黑名单拦截隔离
            if (upper.contains("SYSTEM_CONFIG") || upper.contains("USER_PASSWORD") || upper.contains("SECRET")) {
                throw new SecurityException("【安全拦截】系统核心凭证与密钥表受硬件级策略保护，已触发防越权安全熔断！禁止读取敏感凭据。");
            }
            if (jdbcTemplate != null) {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
                List<Map<String, Object>> safeRows = new java.util.ArrayList<>();
                for (Map<String, Object> row : rows) {
                    Map<String, Object> safeRow = new LinkedHashMap<>();
                    for (Map.Entry<String, Object> entry : row.entrySet()) {
                        String k = entry.getKey().toLowerCase();
                        if (k.contains("key") || k.contains("password") || k.contains("secret") || k.contains("token")) {
                            safeRow.put(entry.getKey(), "****** (企业机密脱敏)");
                        } else {
                            safeRow.put(entry.getKey(), entry.getValue());
                        }
                    }
                    safeRows.add(safeRow);
                }
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("querySql", sql);
                result.put("rowCount", safeRows.size());
                result.put("rows", safeRows.size() > 50 ? safeRows.subList(0, 50) : safeRows);
                return result;
            }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(p, code, 'utf8');
    console.log('Successfully applied database tool security barrier');
} else {
    console.log('Target block not found');
}
