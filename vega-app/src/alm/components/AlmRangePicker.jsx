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
      // Keep current from/to if present, otherwise initialize to the last 30 days
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
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--alm-border)', borderRadius: 3, overflow: 'hidden' }}>
        {PRESETS.map((p, i) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              style={{
                fontSize: 11,
                padding: '6px 12px',
                background: active ? 'var(--alm-text)' : 'transparent',
                color: active ? '#fff' : 'var(--alm-text-muted)',
                border: 'none',
                borderRight: i < PRESETS.length - 1 ? '1px solid var(--alm-border)' : 'none',
                cursor: 'pointer',
              }}
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
            style={{
              fontSize: 11,
              padding: '5px 8px',
              border: '1px solid var(--alm-border)',
              borderRadius: 3,
              background: 'var(--alm-bg)',
              color: 'var(--alm-text)',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--alm-text-faint)' }}>→</span>
          <input
            type="date"
            value={toDateInputValue(to)}
            onChange={setTo}
            style={{
              fontSize: 11,
              padding: '5px 8px',
              border: '1px solid var(--alm-border)',
              borderRadius: 3,
              background: 'var(--alm-bg)',
              color: 'var(--alm-text)',
            }}
          />
        </div>
      )}
    </div>
  );
}
