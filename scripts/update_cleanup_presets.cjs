const fs = require('fs');
const path = require('path');

// 1. Update FinOpsService.java
const finOpsPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/FinOpsService.java';
const finOpsContent = `package com.ownsudo.service;

import com.ownsudo.repository.NodeExecutionRepository;
import com.ownsudo.repository.WorkflowInstanceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class FinOpsService {

    @Autowired
    private WorkflowInstanceRepository instanceRepository;

    @Autowired
    private NodeExecutionRepository nodeExecutionRepository;

    public Map<String, Object> getFinOpsMetrics() {
        long totalInstances = instanceRepository.count();
        long completedInstances = instanceRepository.findAll().stream()
                .filter(i -> "COMPLETED".equalsIgnoreCase(i.getStatus()))
                .count();

        // 真实统计数据库实际节点执行所消耗的 Token，绝不凭空伪造
        long totalTokens = nodeExecutionRepository.findAll().stream()
                .mapToLong(e -> e.getCostTokens() != null ? e.getCostTokens() : 0)
                .sum();

        double deepSeekCost = (totalTokens * 0.8) * 0.000016; // ¥0.016 / 1k tokens
        double qwenCost = (totalTokens * 0.2) * 0.000008;     // ¥0.008 / 1k tokens
        double totalCostCny = Math.round((deepSeekCost + qwenCost) * 100.0) / 100.0;

        double hoursSaved = Math.round((completedInstances * 0.75) * 10.0) / 10.0;
        double laborCostSavedCny = Math.round(hoursSaved * 120.0);
        double roiMultiplier = totalCostCny > 0 ? Math.round((laborCostSavedCny / totalCostCny) * 10.0) / 10.0 : 0.0;

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("totalInstances", totalInstances);
        res.put("completedInstances", completedInstances);
        res.put("totalTokensBurned", totalTokens);
        res.put("totalCostCny", totalCostCny);
        res.put("hoursSaved", hoursSaved);
        res.put("laborCostSavedCny", laborCostSavedCny);
        res.put("roiMultiplier", roiMultiplier + "x");
        res.put("activeBudgetQuotaCny", 5000.0);
        res.put("budgetUsedPercent", totalCostCny > 0 ? Math.min(100.0, Math.round((totalCostCny / 5000.0) * 1000.0) / 10.0) : 0.0);

        // 无真实花费时不伪造部门占比
        if (totalCostCny > 0) {
            res.put("departmentBreakdown", List.of(
                Map.of("dept", "业务自动化运行中枢", "sharePercent", 100, "costCny", totalCostCny)
            ));
            res.put("modelCostMatrix", List.of(
                Map.of("model", "生产大模型实际推流", "role", "Production Inference", "tokens", totalTokens, "rate", "按量计费", "cost", totalCostCny)
            ));
        } else {
            res.put("departmentBreakdown", Collections.emptyList());
            res.put("modelCostMatrix", Collections.emptyList());
        }

        res.put("timestamp", LocalDateTime.now().toString());
        return res;
    }
}
`;
fs.writeFileSync(finOpsPath, finOpsContent, 'utf8');
console.log('Updated FinOpsService.java');

// 2. Update WorkflowDefinitionService.java
const wfPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/service/WorkflowDefinitionService.java';
const wfContent = `package com.ownsudo.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ownsudo.entity.WorkflowDefinition;
import com.ownsudo.repository.WorkflowDefinitionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class WorkflowDefinitionService {

    @Autowired
    private WorkflowDefinitionRepository definitionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    // 严禁 @PostConstruct 硬编码预置伪造工作流，所有工作流均存入数据库由用户真实创建与管理
    public List<WorkflowDefinition> getAllDefinitions() {
        return definitionRepository.findAll();
    }

    public Optional<WorkflowDefinition> getById(String id) {
        return definitionRepository.findById(id);
    }

    public WorkflowDefinition save(WorkflowDefinition def) {
        if (def.getId() == null || def.getId().isBlank()) {
            def.setId("wf-" + UUID.randomUUID().toString().substring(0, 8));
        }
        return definitionRepository.save(def);
    }

    public void delete(String id) {
        definitionRepository.deleteById(id);
    }
}
`;
fs.writeFileSync(wfPath, wfContent, 'utf8');
console.log('Updated WorkflowDefinitionService.java');

// 3. Update DatabaseDataInitializer.java
const initPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/config/DatabaseDataInitializer.java';
const initContent = `package com.ownsudo.config;

import com.ownsudo.entity.McpTool;
import com.ownsudo.repository.McpToolRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseDataInitializer implements CommandLineRunner {

    private final McpToolRepository toolRepository;

    public DatabaseDataInitializer(McpToolRepository toolRepository) {
        this.toolRepository = toolRepository;
    }

    @Override
    public void run(String... args) {
        // 彻底移除对假智能体、假知识库切片和假专家技能的硬编码预置！
        // 数据库保持完全真实干净，所有实体均可由用户通过界面真实创建、编辑与删除。
        initRealSystemTools();
    }

    private void initRealSystemTools() {
        if (toolRepository.count() > 0) return;

        // 仅注册 ToolExecutor 中实际真实实现的 4 个安全工具插件，真实标注其功能与参数
        McpTool t1 = new McpTool();
        t1.setId("tool-db-query");
        t1.setServerName("enterprise-database");
        t1.setFunctionName("query_enterprise_db");
        t1.setDisplayName("企业数据库只读 SQL 查询");
        t1.setDescription("受控只读 SQL 执行器：执行 SELECT/SHOW/EXPLAIN 查询，带有高危 DDL/DML 安全拦截熔断");
        t1.setCategory("SYSTEM");
        t1.setEnabled(true);
        t1.setParametersSchema("{\\n  \\"sql\\": \\"SELECT * FROM system_config\\"\\n}");
        toolRepository.save(t1);

        McpTool t2 = new McpTool();
        t2.setId("tool-calc");
        t2.setServerName("math-engine");
        t2.setFunctionName("calculate_expression");
        t2.setDisplayName("高精度财务与数学计算");
        t2.setDescription("调用后端 BigDecimal 精度引擎计算数学与财务公式，规避大模型数值幻觉");
        t2.setCategory("SYSTEM");
        t2.setEnabled(true);
        t2.setParametersSchema("{\\n  \\"expression\\": \\"(18500 * 0.85) + 3200\\"\\n}");
        toolRepository.save(t2);

        McpTool t3 = new McpTool();
        t3.setId("tool-iban");
        t3.setServerName("finance-validator");
        t3.setFunctionName("validate_iso20022_iban");
        t3.setDisplayName("ISO 20022 IBAN 账户核验");
        t3.setDescription("执行银行 IBAN 真实 MOD-97 校验码运算与国家代码格式校验");
        t3.setCategory("BUSINESS");
        t3.setEnabled(true);
        t3.setParametersSchema("{\\n  \\"iban\\": \\"DE89370400440532013000\\"\\n}");
        toolRepository.save(t3);

        McpTool t4 = new McpTool();
        t4.setId("tool-tax-credit");
        t4.setServerName("secops-validator");
        t4.setFunctionName("verify_tax_credit_code");
        t4.setDisplayName("统一社会信用代码 GB32100 核验");
        t4.setDescription("按照国家 GB 32100-2015 算法加权核验 18 位统一社会信用代码校验位");
        t4.setCategory("BUSINESS");
        t4.setEnabled(true);
        t4.setParametersSchema("{\\n  \\"code\\": \\"91310000775785552L\\"\\n}");
        toolRepository.save(t4);
    }
}
`;
fs.writeFileSync(initPath, initContent, 'utf8');
console.log('Updated DatabaseDataInitializer.java');
