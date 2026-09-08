import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorkLayout } from "./components/WorkLayout";
import { ExtensionsPage } from "./pages/ExtensionsPage";
import { ClipsLibraryPage } from "./pages/ClipsLibraryPage";
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
        <Route path="/tools/extensions" element={<ExtensionsPage />} />
        <Route path="/tools/clips" element={<ClipsLibraryPage />} />
        <Route path="/tools/mirror" element={<Navigate to="/tools/extensions" replace />} />
        <Route path="/tools/eval" element={<Navigate to="/work/dev-debug?tab=eval" replace />} />
        <Route path="/tools/clip-hub" element={<Navigate to="/tools/extensions" replace />} />
        <Route path="/for-you" element={<SecretRomancePage />} />
        <Route path="/about" element={<Navigate to="/resume" replace />} />
        <Route path="/demo/*" element={<Navigate to="/work/imean" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
