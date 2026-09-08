import type { ComponentType } from "react";
import { ClipHubDemo } from "./demos/ClipHubDemo";
import { EnvDemo } from "./demos/EnvDemo";
import { WireDemo } from "./demos/WireDemo";

export const EXTENSION_DEMOS: Record<string, ComponentType> = {
  "clip-hub": ClipHubDemo,
  env: EnvDemo,
  wire: WireDemo,
};

export { ClipHubDemo, EnvDemo, WireDemo };
