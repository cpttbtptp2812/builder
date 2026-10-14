import json
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "data" / "resumeContent.ts"
text = path.read_text(encoding="utf-8")
anchor = 'plain: {\n      name: "OwnAgent'
plain_at = text.find(anchor)
desc_key = text.find("      description:\n        ", plain_at)
end = text.find('\n    },\n  },\n  {\n    id: "jianchi"', plain_at)
if min(plain_at, desc_key, end) < 0:
    raise SystemExit(f"bounds {plain_at} {desc_key} {end}")
q = text.find('"', desc_key)

description = """OwnAgent 是我独立开发的企业办事 Agent（2026.03 至今）。客户上传 Excel、PDF 或 CSV，办理报销对账、客服工单、门店排班，并下载文书。React、Hono、SQLite，Docker 可部署。

1. 服务端按技能步骤办理，金额由计算程序写出，模型只生成说明。办理记录只追加，可回放，可从中间步骤重跑。
2. 线上版本与草稿用同一批问句回放。单步被替换、跳过或换工具后，只重跑后续步骤。该检查由 GitHub Action 执行。
3. 报销规则用 Z3 证明两版是否一致，不一致则给出反例并重新计算。排班用 HiGHS 做 0-1 整数规划并给出最优解。办理材料和数字做成 Merkle 树，Ed25519 签名，可离线验真。
4. 自行实现 SSE 工具调用和进程内 MCP。检索为关键词与 TF-IDF 混合，结果可回到原文。权限变更经人工确认后提交。"""

performance = """1. 报销对账、客服工单、门店排班交付完成，文书金额与客户原表一致
2. 技能发布与 GitHub Action 打通，通过检查后才替换线上版本
3. 规则、排班和办理记录在发布时保留核对结论"""

block = (
    json.dumps(description, ensure_ascii=False)
    + ",\n      performance:\n        "
    + json.dumps(performance, ensure_ascii=False)
    + ","
)
text = text[:q] + block + text[end:]

old_bg = "OwnAgent 是我独立设计并全栈开发的企业业务 Agent。报销对账、客服工单、门店排班在服务端办理并交付文书。Agent 循环、MCP 工具调用和 RAG 自行实现，发布前用回放评测决定能否上线，规则与排班分别用 Z3、HiGHS 复核。"
new_bg = "OwnAgent 是我独立开发的企业办事 Agent（2026.03 至今）。客户上传表格或 PDF，办理报销对账、客服工单、门店排班并下载文书。"
if old_bg not in text:
    raise SystemExit("background missing")
text = text.replace(old_bg, new_bg, 1)

old_ach = '''    achievements: [
      "独立完成设计与全栈开发，页面、服务端、技能执行和发布检查均已交付，可用 Docker 部署",
      "报销对账、客服工单、门店排班已跑通，客户提交表格后由服务端生成文书，金额来自程序计算",
      "发布检查已接入 GitHub Action，与本地执行同一套回放，通过后替换线上版本",
    ],'''
new_ach = '''    achievements: [
      "报销对账、客服工单、门店排班交付完成，文书金额与客户原表一致",
      "技能发布与 GitHub Action 打通，通过检查后才替换线上版本",
      "规则、排班和办理记录在发布时保留核对结论",
    ],'''
if old_ach not in text:
    raise SystemExit("achievements missing")
text = text.replace(old_ach, new_ach, 1)
path.write_text(text, encoding="utf-8")
print("ok")
