import type { ComponentType } from "react";
import { ClipHubDemo } from "./demos/ClipHubDemo";
import { EnvDemo } from "./demos/EnvDemo";
import { SkillTapDemo } from "./demos/SkillTapDemo";
import { WireDemo } from "./demos/WireDemo";

export const EXTENSION_DEMOS: Record<string, ComponentType> = {
  "clip-hub": ClipHubDemo,
  env: EnvDemo,
  wire: WireDemo,
  skilltap: SkillTapDemo,
};

export { ClipHubDemo, EnvDemo, WireDemo, SkillTapDemo };
