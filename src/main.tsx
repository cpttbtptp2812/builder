import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ensureDemoReady } from "./lib/demoSeed";
import "./styles.css";

ensureDemoReady();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
