import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorkLayout } from "./components/WorkLayout";
import { ClipHubDownloadPage } from "./pages/ClipHubDownloadPage";
import { HomePage } from "./pages/HomePage";
import { ResumePage } from "./pages/ResumePage";
import { SecretRomancePage } from "./pages/SecretRomancePage";
import { WorkRouter } from "./works/WorkRouter";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/work/:slug" element={<WorkLayout />}>
          <Route index element={<WorkRouter />} />
        </Route>
        <Route path="/resume" element={<ResumePage />} />
        <Route path="/tools/clip-hub" element={<ClipHubDownloadPage />} />
        <Route path="/for-you" element={<SecretRomancePage />} />
        <Route path="/about" element={<Navigate to="/resume" replace />} />
        <Route path="/demo/*" element={<Navigate to="/work/imean" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
