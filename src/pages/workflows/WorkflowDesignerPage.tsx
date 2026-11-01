import React from "react";
import WorkflowStepWizard from "./WorkflowStepWizard";
import { PipelineItem, AgentItem } from "../../types/platform";

export interface WorkflowDesignerPageProps {
  workflow?: PipelineItem | null;
  agents: AgentItem[];
  onBack: () => void;
  onSave?: (saved: PipelineItem) => void;
  onSaveAndLaunch?: (saved: PipelineItem, prompt?: string) => void;
}

export const WorkflowDesignerPage: React.FC<WorkflowDesignerPageProps> = (props) => {
  return <WorkflowStepWizard {...props} />;
};

export default WorkflowDesignerPage;
