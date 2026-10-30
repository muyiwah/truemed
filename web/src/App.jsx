import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useSettings } from './lib/settings.jsx';
import Welcome from './pages/Welcome.jsx';
import Home from './pages/Home.jsx';

const Scan = lazy(() => import('./pages/Scan.jsx'));
const Receive = lazy(() => import('./pages/Receive.jsx'));
const CaseFile = lazy(() => import('./pages/CaseFile.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const How = lazy(() => import('./pages/How.jsx'));
const Labels = lazy(() => import('./pages/Labels.jsx'));

const Fallback = () => <div className="grid min-h-dvh place-items-center text-ink-3">Loading…</div>;

export default function App() {
  const { hasLanguage } = useSettings();
  const location = useLocation();
  return (
    <Suspense fallback={<Fallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={hasLanguage ? <Home /> : <Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/check" element={<Scan />} />
          <Route path="/sample/:sampleId" element={<Scan />} />
          <Route path="/receive" element={<Receive />} />
          <Route path="/case/:sessionId" element={<CaseFile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/how" element={<How />} />
          <Route path="/labels" element={<Labels />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
