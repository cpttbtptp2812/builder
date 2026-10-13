/**
 * 办事程序注册表（引擎部分）：服务端 callTool 与文书都从这里找引擎。
 * 声明部分（材料、模板、步骤名）在 deskProgramMeta.ts。
 */

import {
  deskEnvFromArgs,
  runDeskPipeline,
  runDeskTool,
  type DeskArgs,
  type DeskProgram,
  type DeskToolOutput,
  type TablesPaper,
} from "./deskProgramKit";
import { TICKET_DESK_PROGRAM } from "./ticketDeskProgram";
import { SHIFT_DESK_PROGRAM } from "./shiftDeskProgram";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROGRAMS: DeskProgram<any>[] = [TICKET_DESK_PROGRAM, SHIFT_DESK_PROGRAM];

export function deskProgramForTool(tool: string) {
  return PROGRAMS.find((p) => tool in p.phases);
}

export function deskProgramForSkill(skillId: string) {
  return PROGRAMS.find((p) => p.skillId === skillId);
}

export function runRegisteredDeskTool(
  tool: string,
  args: DeskArgs,
  vars: Record<string, unknown>,
  query: string,
): DeskToolOutput | null {
  const program = deskProgramForTool(tool);
  if (!program) return null;
  return runDeskTool(program, tool, args, vars, deskEnvFromArgs(args, query));
}

export function deskPaperForSkill(
  skillId: string,
  steps: { tool: string; args?: DeskArgs }[],
  env: { sessionId?: string; productWorkbench: boolean; query: string },
): TablesPaper | null {
  const program = deskProgramForSkill(skillId);
  if (!program) return null;
  const state = runDeskPipeline(program, steps, env);
  return state ? program.paper(state) : null;
}
