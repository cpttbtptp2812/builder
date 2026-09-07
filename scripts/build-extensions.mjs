#!/usr/bin/env node
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stat, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extDir = join(root, "extensions");
const outDir = join(root, "public", "downloads");

const PUBLISH = {
  clip: "ClipHub-Extension-v1.2.0.zip",
  mirror: "Mirror-Extension-v1.0.0.zip",
  env: "Env-Extension-v1.0.0.zip",
  wire: "Wire-Extension-v1.0.0.zip",
};

async function isDir(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

function zipFolder(src, dest) {
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${src.replace(/'/g, "''")}\\*' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`,
      { stdio: "inherit" },
    );
  } else {
    execSync(`cd "${src}" && zip -r "${dest}" . -x "*.DS_Store"`, { stdio: "inherit" });
  }
}

await mkdir(outDir, { recursive: true });

for (const [name, outName] of Object.entries(PUBLISH)) {
  const src = join(extDir, name);
  if (!(await isDir(src))) {
    console.warn(`missing ${name}`);
    continue;
  }
  console.log(`pack ${name} -> ${outName}`);
  zipFolder(src, join(outDir, outName));
}

console.log("done");
