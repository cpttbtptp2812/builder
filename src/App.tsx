import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorkLayout } from "./components/WorkLayout";
import { ExtensionDetailPage } from "./pages/ExtensionDetailPage";
import { ExtensionsPage } from "./pages/ExtensionsPage";
import { ClipsLibraryPage } from "./pages/ClipsLibraryPage";
import { HomePage } from "./pages/HomePage";
import { ResumePage } from "./pages/ResumePage";
import { SecretRomancePage } from "./pages/SecretRomancePage";
import { WorkRouter } from "./works/WorkRouter";
import { AdminPage } from "./pages/AdminPage";

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
        <Route path="/tools/extensions/:extId" element={<ExtensionDetailPage />} />
        <Route path="/tools/clips" element={<ClipsLibraryPage />} />
        <Route path="/tools/mirror" element={<Navigate to="/tools/extensions" replace />} />
        <Route path="/tools/eval" element={<Navigate to="/work/ownagent?tab=product&view=eval" replace />} />
        <Route path="/tools/clip-hub" element={<Navigate to="/tools/extensions" replace />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/for-you" element={<SecretRomancePage />} />
        <Route path="/about" element={<Navigate to="/resume" replace />} />
        <Route path="/demo/*" element={<Navigate to="/work/imean" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
