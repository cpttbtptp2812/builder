/** 取舍前沿：每个指标都是越小越好，被全面超过的点不在前沿上。 */
import { paretoFront } from "../src/lib/pareto.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const front = paretoFront([
  { id: "a", axes: [1, 3] },
  { id: "b", axes: [2, 1] },
  { id: "c", axes: [3, 3] },
  { id: "d", axes: [1, 3] },
]).sort();
expect(front.join(",") === "a,b,d", `前沿应留下没被全面超过的点，得到 ${front.join(",")}`);
expect(!paretoFront([{ id: "only", axes: [] }]).includes("only") || paretoFront([{ id: "only", axes: [1] }]).includes("only"), "单点应留在前沿");
expect(paretoFront([{ id: "only", axes: [4] }]).join() === "only", "只有一个点时它自己就是前沿");
console.log("ok pareto");
