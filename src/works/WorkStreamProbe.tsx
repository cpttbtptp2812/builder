import { Link } from "react-router-dom";

/** StreamProbe 已归档 — 重定向说明 */
export function WorkStreamProbe() {
  return (
    <div className="work-streamprobe sp-page" style={{ padding: "2rem 1rem", maxWidth: 560 }}>
      <h1>StreamProbe 已归档</h1>
      <p style={{ lineHeight: 1.6, color: "#57534e" }}>
        流式 Chrome 扩展实验已停止主推。SSE 协议对照请看{" "}
        <Link to="/work/sse">GraphQL SSE 实验室</Link>
        ；Agent 语义链路请看{" "}
        <Link to="/work/ownagent">OwnAgent</Link>。
      </p>
    </div>
  );
}
