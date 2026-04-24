// ═══════════════════════════════════════════════
// ALM — Root Component
// Reporting dashboard fed by the Daily Log sheet
// that the Apps Script form writes to. Tabs:
// Today, Admissions, Trends, Daily Report.
// ═══════════════════════════════════════════════

import { Routes, Route, Navigate } from 'react-router-dom';
import AlmHeader from './components/AlmHeader';
import AlmToast from './components/AlmToast';
import AlmToday from './pages/AlmToday';
import AlmOutreach from './pages/AlmOutreach';
import AlmTrends from './pages/AlmTrends';
import AlmForm from './pages/AlmForm';
import './alm-theme.css';

export default function AlmApp() {
  return (
    <div className="alm-root">
      <AlmHeader />
      <Routes>
        <Route path="/" element={<AlmToday />} />
        <Route path="/outreach" element={<AlmOutreach />} />
        <Route path="/trends" element={<AlmTrends />} />
        <Route path="/form" element={<AlmForm />} />
        <Route path="*" element={<Navigate to="/alm" replace />} />
      </Routes>
      <AlmToast />
    </div>
  );
}
