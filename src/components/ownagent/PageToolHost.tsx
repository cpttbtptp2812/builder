import { useEffect, useState } from "react";
import { installOwnAgentPageTools } from "../../lib/ownAgentPageTools";
import { currentConsent, respondConsent, subscribeConsent } from "../../lib/pageTools";

/** 挂上这一页的工具，并在会改数据时停下来问一句。 */
export function PageToolHost() {
  const [pending, setPending] = useState(currentConsent);

  useEffect(() => installOwnAgentPageTools(), []);
  useEffect(() => subscribeConsent(() => setPending(currentConsent())), []);

  if (!pending) return null;
  return (
    <div className="own-page-consent" role="dialog" aria-label="这一页要改数据">
      <p>
        <strong>{pending.label}</strong>
        <span>{pending.explain}</span>
      </p>
      <div>
        <button type="button" onClick={() => respondConsent(false)}>
          拒绝
        </button>
        <button type="button" className="is-allow" onClick={() => respondConsent(true)}>
          允许
        </button>
      </div>
    </div>
  );
}
