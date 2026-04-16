// ═══════════════════════════════════════════════
// ALM — Range Picker
// Preset pills (Daily/Weekly/Monthly/Quarterly/Annual)
// plus Custom with from/to date inputs.
// ═══════════════════════════════════════════════

import { PRESETS, computeRange, toDateInputValue, fromDateInputValue } from '../utils/range';

export default function AlmRangePicker({ value, onChange }) {
  const { preset, from, to } = value;

  const setPreset = (id) => {
    if (id === 'custom') {
      const fallback = computeRange('monthly');
      onChange({
        preset: 'custom',
        from: from || fallback.from,
        to:   to   || fallback.to,
      });
    } else {
      onChange(computeRange(id));
    }
  };

  const setFrom = (e) => {
    const d = fromDateInputValue(e.target.value);
    onChange({ preset: 'custom', from: d, to });
  };

  const setTo = (e) => {
    const d = fromDateInputValue(e.target.value);
    if (d) d.setHours(23, 59, 59, 999);
    onChange({ preset: 'custom', from, to: d });
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="alm-pill-group">
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`alm-pill${active ? ' alm-pill--active' : ''}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {preset === 'custom' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="date"
            value={toDateInputValue(from)}
            onChange={setFrom}
            className="alm-input"
          />
          <span className="alm-mono" style={{ fontSize: 11, color: 'var(--alm-ink-5)' }}>→</span>
          <input
            type="date"
            value={toDateInputValue(to)}
            onChange={setTo}
            className="alm-input"
          />
        </div>
      )}
    </div>
  );
}
