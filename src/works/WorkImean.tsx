import { useSearchParams } from "react-router-dom";

import { ImeanProductDemo } from "../components/fx/ImeanProductDemo";

import { WorkGuide } from "../components/WorkGuide";

import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";

import { getWork } from "../data/works";



/** iMean AI 成品展示 */

export function WorkImean() {

  const [params] = useSearchParams();

  const autoDemo = params.get("demo") === "1" || params.get("demo") === "true";

  const locator = getWork("locator");

  const sdk = getWork("sdk");



  return (

    <div className="work-imean work-agent-rich">

      <WorkGuide slug="imean" />

      <ImeanProductDemo autoStart={autoDemo} />

      {locator && sdk && (

        <WorkTechDeepLinks

          intro="上面是成品对话 + DOM 回放；下面两个实验室可单独交互 Worker 匹配、定位策略瀑布、TaskQueue / gzip 队列。"

          links={[locator, sdk]}

        />

      )}

    </div>

  );

}


