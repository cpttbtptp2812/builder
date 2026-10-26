import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { UnifiedAppPortal } from "./pages/UnifiedAppPortal";
import { WorkLayout } from "./components/WorkLayout";
import { ExtensionDetailPage } from "./pages/ExtensionDetailPage";
import { ExtensionsPage } from "./pages/ExtensionsPage";
import { ClipsLibraryPage } from "./pages/ClipsLibraryPage";
import { SecretRomancePage } from "./pages/SecretRomancePage";
import { WorkRouter } from "./works/WorkRouter";
import { AdminPage } from "./pages/AdminPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 全站三大核心选项卡统一在同一个单页门户中，同页无缝切换 */}
        <Route path="/" element={<UnifiedAppPortal />} />
        <Route path="/lab" element={<UnifiedAppPortal />} />
        <Route path="/resume" element={<UnifiedAppPortal />} />
        <Route path="/workbench" element={<UnifiedAppPortal />} />
        <Route path="/work/ownagent" element={<UnifiedAppPortal />} />

        {/* 独立项目展示台（从实验室点击打开） */}
        <Route path="/work/:slug" element={<WorkLayout />}>
          <Route index element={<WorkRouter />} />
        </Route>

        {/* 工具类与独立扩展页面 */}
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
