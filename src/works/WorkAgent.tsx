import { useEffect, useState } from "react";

import { useSearchParams } from "react-router-dom";

import { AgentProductDemo } from "../components/fx/AgentProductDemo";

import { WorkGuide } from "../components/WorkGuide";

import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";

import { getWork } from "../data/works";



/** UniAgent 成品展示 */

export function WorkAgent() {

  const [params] = useSearchParams();

  const [auto, setAuto] = useState(false);

  const sse = getWork("sse");



  useEffect(() => {

    if (params.get("demo") === "1" || params.get("demo") === "true") setAuto(true);

  }, [params]);



  return (

    <div className="work-agent work-agent-rich">

      <WorkGuide slug="agent" />

      <AgentProductDemo autoStart={auto} />

      {sse && (

        <WorkTechDeepLinks

          intro="上面是 SSE 流式对话 + Tool Call + noVNC；下面实验室可看原始 SSE 帧、UIMessage 映射与 pause/resume 断线续传。"

          links={[sse]}

        />

      )}

    </div>

  );

}


