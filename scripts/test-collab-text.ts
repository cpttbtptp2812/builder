/** 两份草稿同时改不同的字，合并后两边一致。 */
import * as Y from "yjs";
import { applyTextEdit } from "../src/lib/collabEdit.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const left = new Y.Doc();
const right = new Y.Doc();
const leftText = left.getText("draft");
const rightText = right.getText("draft");
left.transact(() => applyTextEdit(leftText, "", "abcdef"));
Y.applyUpdate(right, Y.encodeStateAsUpdate(left));
expect(rightText.toString() === "abcdef", "初始文本没有同步过去");

const fromLeft: Uint8Array[] = [];
const fromRight: Uint8Array[] = [];
left.on("update", (update) => fromLeft.push(update));
right.on("update", (update) => fromRight.push(update));
left.transact(() => applyTextEdit(leftText, "abcdef", "abXcdef"));
right.transact(() => applyTextEdit(rightText, "abcdef", "abcdefY"));
for (const update of fromRight) Y.applyUpdate(left, update);
for (const update of fromLeft) Y.applyUpdate(right, update);
expect(leftText.toString() === rightText.toString(), `合并后两边不一致：${leftText.toString()} / ${rightText.toString()}`);
expect(leftText.toString().includes("X") && leftText.toString().includes("Y"), `两边的修改都应该留下，得到 ${leftText.toString()}`);
console.log("ok collab-text");
