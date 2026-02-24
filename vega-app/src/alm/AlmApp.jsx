// ═══════════════════════════════════════════════
// ALM — Root Component
// Self-contained Assisted Living Management module
// This file is the single entry point wired into
// the main App.jsx router. Everything below this
// is fully independent of Private Equity code.
// ═══════════════════════════════════════════════

import { Routes, Route } from 'react-router-dom';
import AlmHeader from './components/AlmHeader';
import AlmToast from './components/AlmToast';
import AlmDashboard from './pages/AlmDashboard';

export default function AlmApp() {
  return (
    <>
      <AlmHeader />
      <Routes>
        <Route path="/" element={<AlmDashboard />} />
        {/* Future ALM routes:
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/residents" element={<Residents />} />
        <Route path="/compliance" element={<AlmCompliance />} />
        <Route path="/reports" element={<AlmReports />} />
        */}
      </Routes>
      <AlmToast />
    </>
  );
}
