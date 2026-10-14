/** 把一次文本编辑收成 Y.Text 的最小替换，两个人同时改才能合并 */

import * as Y from "yjs";

export function applyTextEdit(text: Y.Text, prev: string, next: string): void {
  if (prev === next) return;
  let start = 0;
  const prevLen = prev.length;
  const nextLen = next.length;
  while (start < prevLen && start < nextLen && prev[start] === next[start]) start += 1;
  let endPrev = prevLen;
  let endNext = nextLen;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev -= 1;
    endNext -= 1;
  }
  text.delete(start, endPrev - start);
  const insert = next.slice(start, endNext);
  if (insert) text.insert(start, insert);
}
