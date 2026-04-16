// ═══════════════════════════════════════════════
// ALM — Facility / Fund Filter
// Two-tier pill selector. Top row picks scope
// (All · Fund I · Fund II). Bottom row picks an
// individual facility; pills not in the current
// fund are dimmed so the grouping stays visible
// without hiding the list.
// ═══════════════════════════════════════════════

import { FUNDS, shortFacility } from '../config/funds';
import { facilityMatchesScope } from '../utils/scope';

export default function AlmFacilityFilter({ facilities, value, onChange }) {
  const isAll       = value.type === 'all';
  const activeFund  = value.type === 'fund' ? value.value : null;
  const activeFac   = value.type === 'facility' ? value.value : null;

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="alm-pill-group">
        <button
          className={`alm-pill${isAll ? ' alm-pill--active' : ''}`}
          onClick={() => onChange({ type: 'all' })}
        >
          All
        </button>
        {FUNDS.map((f) => (
          <button
            key={f.id}
            className={`alm-pill${activeFund === f.id ? ' alm-pill--active' : ''}`}
            onClick={() => onChange({ type: 'fund', value: f.id })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {facilities.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {facilities.map((fac) => {
            const inScope = facilityMatchesScope(fac, value);
            const active = activeFac === fac;
            return (
              <button
                key={fac}
                onClick={() => onChange({ type: 'facility', value: fac })}
                className={`alm-chip${active ? ' alm-chip--active' : ''}`}
                style={!active && !inScope ? { opacity: 0.35 } : undefined}
                title={fac}
              >
                {shortFacility(fac)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
