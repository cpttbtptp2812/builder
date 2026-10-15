import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ensureDemoReady } from "./lib/demoSeed";
import "./styles.css";
import "./styles/ownagent-product-chat.css";
import "./styles/ownagent-premium.css";
import "./styles/ownagent-skill-page.css";

ensureDemoReady();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
