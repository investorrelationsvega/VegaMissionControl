// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Formatting Utilities
// ═══════════════════════════════════════════════

export const fmt = n =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export const fmtK = n =>
  n >= 1e6
    ? `$${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
      ? `$${(n / 1e3).toFixed(0)}K`
      : `$${n}`;
