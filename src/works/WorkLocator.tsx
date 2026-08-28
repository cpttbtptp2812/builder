import { TechBadgeBar } from "../components/TechBadgeBar";
import { WorkGuide } from "../components/WorkGuide";
import { LocatePlayground } from "../components/fx/LocatePlayground";

/** 元素定位：多策略瀑布 */
export function WorkLocator() {
  return (
    <div className="work-locator work-tech-lab">
      <WorkGuide slug="locator" />
      <TechBadgeBar items={["策略瀑布", "Shadow DOM", "IndexedDB", "dispatchEvent"]} />

      <div className="tech-lab">
        <LocatePlayground />
      </div>
    </div>
  );
}
