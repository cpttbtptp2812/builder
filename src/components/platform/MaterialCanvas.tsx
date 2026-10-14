/** 办完之后看这份材料本身。点结论里的数字，高亮原来的单元格。 */

import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/apiClient";
import { productHeaders } from "../../lib/productRun/client";
import { extractLockedNumbers } from "../../lib/llmProductBrief";
import type { SourceCell } from "../../lib/workbookImport";

type Material = {
  slot: string;
  label: string;
  title: string;
  columns: string[];
  rows: string[][];
  cells: SourceCell[];
};

export function MaterialCanvas({ sessionId, skillId, summary }: { sessionId: string; skillId: string; summary: string }) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);
  const numbers = extractLockedNumbers(summary);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ sessionId, skillId });
    void fetch(apiUrl(`/product-run/materials?${q}`), { headers: productHeaders() })
      .then(async (res) => {
        const data = (await res.json()) as { materials?: Material[]; error?: string };
        if (!alive) return;
        if (!res.ok) return setError(data.error || "材料没有读出来");
        setMaterials(data.materials ?? []);
      })
      .catch(() => alive && setError("材料没有读出来"));
    return () => {
      alive = false;
    };
  }, [sessionId, skillId]);

  if (error) return <p className="pl-error">{error}</p>;
  if (!materials) return <p className="pl-note">正在读取这次导入的材料…</p>;
  const filled = materials.filter((item) => item.rows.length);
  if (!filled.length) return <p className="pl-note">这次办理没有留下可点开的材料表。</p>;

  return (
    <div className="mc">
      <p className="pl-note">下面是这次导入的原表。点结论里的数字，会标出表里相同的值从哪一格来。</p>
      {numbers.length ? (
        <div className="mc-nums">
          {numbers.map((n) => (
            <button key={n} type="button" className={hit === n ? "is-on" : ""} onClick={() => setHit((cur) => (cur === n ? null : n))}>
              {n}
            </button>
          ))}
        </div>
      ) : null}
      {filled.map((material) => (
        <section key={material.slot}>
          <h3>
            {material.label}
            <small>{material.title}</small>
          </h3>
          <div className="mc-scroll">
            <table>
              <thead>
                <tr>
                  {material.cells.length ? <th>位置</th> : null}
                  {material.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {material.rows.map((row, ri) => (
                  <tr key={ri}>
                    {material.cells.length ? <td className="mc-loc">{locate(material.cells, ri)}</td> : null}
                    {row.map((value, ci) => {
                      const on = hit != null && normalize(value) === hit;
                      const cell = material.cells.find((item) => item.row === ri + 2 && item.column === material.columns[ci]);
                      return (
                        <td key={ci} className={on ? "is-hit" : ""} title={cell ? `${cell.sheet}!${cell.cell}` : undefined}>
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function normalize(value: string): string {
  return value.replace(/,/g, "").trim();
}

function locate(cells: SourceCell[], rowIndex: number): string {
  const hit = cells.find((cell) => cell.row === rowIndex + 2);
  return hit ? `${hit.sheet}!${hit.cell.replace(/\d+$/, "")}${hit.row}` : "";
}
