import { TechBadgeBar } from "../components/TechBadgeBar";
import { WorkGuide } from "../components/WorkGuide";
import { ReactFlowWorkbench } from "../components/fx/ReactFlowWorkbench";

/** Builder：React Flow + AI Copilot 改图 */
export function WorkBuilder() {
  return (
    <div className="work-builder work-tech-lab">
      <WorkGuide slug="builder" />
      <TechBadgeBar items={["React Flow", "dagre", "Valtio", "Copilot"]} />

      <section className="tech-section">
        <header className="tech-section-head">
          <h3>流程编辑器</h3>
          <span>从左侧面板拖节点 · 点 AI 优化 · 模拟运行</span>
        </header>
        <ReactFlowWorkbench />
      </section>
    </div>
  );
}
