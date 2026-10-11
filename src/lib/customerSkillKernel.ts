/** 办事技能：必须走服务端 step 引擎，禁止浏览器 mock / 内置样例假跑 */

import { isCustomerSkill } from "./agentSkills";
import { isCreditFlowSkillId } from "./creditFlowUi";

export function mustRunServerProcessSkill(skillId: string): boolean {
  if (!isCustomerSkill(skillId)) return false;
  if (isCreditFlowSkillId(skillId)) return false;
  return true;
}
