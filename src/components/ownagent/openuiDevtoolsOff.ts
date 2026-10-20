const flags = globalThis as typeof globalThis & { [key: symbol]: boolean };
flags[Symbol.for("openui.devtools.autoMount")] = true;
