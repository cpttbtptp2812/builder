const vscode = require("vscode");
const { execFile } = require("child_process");
const path = require("path");

function isSkillMd(doc) {
  return /SKILL\.md$/i.test(doc.fileName) || doc.fileName.replace(/\\/g, "/").includes("/skills/");
}

function runCheck(workspaceRoot, filePath) {
  return new Promise((resolve, reject) => {
    const script = path.join(workspaceRoot, "scripts", "ownagent-check.ts");
    execFile("npx", ["tsx", script, filePath], { cwd: workspaceRoot, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(stdout || String(err)));
      }
    });
  });
}

function activate(context) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = "ownagent.runCheck";
  status.text = "$(shield) OwnAgent";
  status.show();

  async function refresh(doc) {
    if (!doc || !isSkillMd(doc)) return;
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!folder) return;
    status.text = "$(sync~spin) OwnAgent check…";
    try {
      const report = await runCheck(folder.uri.fsPath, doc.uri.fsPath);
      const r = report.results?.[0];
      if (!r) {
        status.text = "$(shield) OwnAgent";
        return;
      }
      status.text = `$(shield) ${r.gate} · ${r.skillId}`;
      status.backgroundColor =
        r.gate === "BLOCK"
          ? new vscode.ThemeColor("statusBarItem.errorBackground")
          : r.gate === "WARN"
            ? new vscode.ThemeColor("statusBarItem.warningBackground")
            : undefined;
      status.tooltip = r.reasons?.join("\n") ?? "";
    } catch (e) {
      status.text = "$(error) OwnAgent";
      status.tooltip = String(e);
    }
  }

  context.subscriptions.push(
    status,
    vscode.commands.registerCommand("ownagent.runCheck", () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc) void refresh(doc);
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => void refresh(doc)),
    vscode.window.onDidChangeActiveTextEditor((ed) => ed && void refresh(ed.document)),
  );

  if (vscode.window.activeTextEditor) void refresh(vscode.window.activeTextEditor.document);
}

function deactivate() {}

module.exports = { activate, deactivate };
