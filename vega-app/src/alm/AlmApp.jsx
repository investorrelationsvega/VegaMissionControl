// ═══════════════════════════════════════════════
// ALM — Root Component
// Reporting dashboard fed by the ALF Daily
// Operations Google Sheet. Three tabs: Today,
// Outreach, Trends.
// ═══════════════════════════════════════════════

import { Routes, Route, Navigate } from 'react-router-dom';
import AlmHeader from './components/AlmHeader';
import AlmToast from './components/AlmToast';
import AlmToday from './pages/AlmToday';
import AlmOutreach from './pages/AlmOutreach';
import AlmTrends from './pages/AlmTrends';
import './alm-theme.css';

export default function AlmApp() {
  return (
    <div className="alm-root">
      <AlmHeader />
      <Routes>
        <Route path="/" element={<AlmToday />} />
        <Route path="/outreach" element={<AlmOutreach />} />
        <Route path="/trends" element={<AlmTrends />} />
        <Route path="*" element={<Navigate to="/alm" replace />} />
      </Routes>
      <AlmToast />
    </div>
  );
}
