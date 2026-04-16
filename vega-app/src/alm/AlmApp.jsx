// ═══════════════════════════════════════════════
// ALM — Root Component
// Blank shell for Assisted Living Management.
// ═══════════════════════════════════════════════

import { Routes, Route } from 'react-router-dom';
import AlmHeader from './components/AlmHeader';
import AlmToast from './components/AlmToast';
import AlmDashboard from './pages/AlmDashboard';
import './alm-theme.css';

export default function AlmApp() {
  return (
    <div className="alm-root">
      <AlmHeader />
      <Routes>
        <Route path="/" element={<AlmDashboard />} />
      </Routes>
      <AlmToast />
    </div>
  );
}
