# OwnAgent Skill Gate

在 VS Code 状态栏显示当前 `SKILL.md` 的发布门禁结果。

## 使用

1. 在包含 OwnAgent CLI 的仓库中打开 `SKILL.md`。
2. 保存文件，或运行命令 `OwnAgent: Check SKILL.md`。
3. 状态栏显示 `PASS`、`WARN` 或 `BLOCK`；悬停可查看 ΔP、Pivotal Step、Exact 覆盖率和门禁原因。

扩展调用仓库内的 `scripts/ownagent-check.ts`，检查结果与 CI 使用同一份 `ownagent-check/1` 报告。

