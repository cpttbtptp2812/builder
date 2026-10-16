/** 办事技能：必须走服务端 step 引擎，禁止浏览器 mock / 内置样例假跑 */

import { PRODUCT_RETIRED_SKILL_IDS } from "./agentSkills";
import { isCreditFlowSkillId } from "./creditFlowUi";
import { productSkillUsesUserData } from "./productSkillInputs";

export function mustRunServerProcessSkill(skillId: string): boolean {
  if ((PRODUCT_RETIRED_SKILL_IDS as readonly string[]).includes(skillId)) return false;
  if (isCreditFlowSkillId(skillId)) return false;
  return productSkillUsesUserData(skillId);
}
