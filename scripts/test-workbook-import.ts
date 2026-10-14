/** Excel 变成现有导入用的 CSV，并记住原单元格。打不开或排不成表的 PDF 不入账。 */
import ExcelJS from "exceljs";
import { pdfBufferToTable, xlsxBufferToTable } from "../src/lib/workbookImport.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet("报销");
sheet.addRow(["姓名", "金额"]);
sheet.addRow(["李四", 128]);
sheet.getCell("B3").value = { formula: "B2*2", result: 256 };
sheet.addRow(["", ""]);
const buf = new Uint8Array(await book.xlsx.writeBuffer());
const table = await xlsxBufferToTable(buf, "十月报销.xlsx");
if ("error" in table) fail(table.error);
expect(table.title === "十月报销", `标题应是文件名，得到 ${table.title}`);
expect(table.csv.split("\n")[0] === "姓名,金额", `表头不对：${table.csv}`);
expect(table.csv.includes("李四,128"), "数据行应进 CSV");
expect(table.csv.includes("256"), "公式应采用已算出的结果");
const cell = table.cells.find((item) => item.value === "128");
expect(cell?.cell === "B2" && cell.column === "金额" && cell.sheet === "报销", `128 应落在报销!B2，得到 ${cell?.sheet} ${cell?.cell}`);

const broken = await pdfBufferToTable(new TextEncoder().encode("这不是 pdf"), "说明.pdf");
expect("error" in broken && broken.error.includes("打不开"), `打不开的 PDF 必须说明原因且不入账，得到 ${"error" in broken ? broken.error : "表"}`);
console.log("ok workbook-import");
