// ═══════════════════════════════════════════════
// ALM — Formatting Utilities
// ═══════════════════════════════════════════════

export const fmtNum = (n) => (n == null ? '--' : Number(n).toLocaleString());

export const fmtPct = (n, digits = 1) =>
  n == null || !Number.isFinite(n) ? '--' : `${n.toFixed(digits)}%`;

export const fmtDate = (d) => {
  if (!d) return '--';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const fmtDateShort = (d) => {
  if (!d) return '--';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmtRelative = (d) => {
  if (!d) return '--';
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateShort(d);
};

// Returns "2026-04-15" style key for grouping by day
export const dateKey = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
