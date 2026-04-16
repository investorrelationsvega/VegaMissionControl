// ═══════════════════════════════════════════════
// ALM — Date range helpers
// Shared across tabs so presets behave identically.
// ═══════════════════════════════════════════════

import { fmtDate } from './format';

export const PRESETS = [
  { id: 'daily',     label: 'Daily',     days: 1   },
  { id: 'weekly',    label: 'Weekly',    days: 7   },
  { id: 'monthly',   label: 'Monthly',   days: 30  },
  { id: 'quarterly', label: 'Quarterly', days: 90  },
  { id: 'annual',    label: 'Annual',    days: 365 },
  { id: 'custom',    label: 'Custom',    days: null },
];

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

// Build a concrete {from, to} window for a preset or custom pair.
export function computeRange(preset, customFrom, customTo) {
  const to = endOfDay(new Date());
  if (preset === 'custom') {
    return {
      preset,
      from: customFrom ? startOfDay(customFrom) : null,
      to:   customTo   ? endOfDay(customTo)     : null,
    };
  }
  const meta = PRESETS.find((p) => p.id === preset) || PRESETS[2];
  const from = startOfDay(new Date(Date.now() - (meta.days - 1) * 24 * 60 * 60 * 1000));
  return { preset, from, to };
}

// Default range: Monthly, ending now.
export const defaultRange = () => computeRange('monthly');

export function rangeLabel({ preset, from, to }) {
  if (!from || !to) return 'Select a range';
  const meta = PRESETS.find((p) => p.id === preset);
  if (preset === 'daily')   return `Today · ${fmtDate(to)}`;
  if (preset === 'weekly')  return 'Last 7 days';
  if (preset === 'monthly') return 'Last 30 days';
  if (preset === 'quarterly') return 'Last 90 days';
  if (preset === 'annual')  return 'Last 365 days';
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

export function rowInRange(row, range) {
  if (!row?.date || !range?.from || !range?.to) return false;
  return row.date >= range.from && row.date <= range.to;
}

// Format a Date as YYYY-MM-DD for <input type="date">
export const toDateInputValue = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const fromDateInputValue = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
