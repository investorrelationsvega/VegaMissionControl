// ═══════════════════════════════════════════════
// ALM — Facility / Fund Filter
// Fund pills on the left (All · Fund I · Fund II)
// with a facility dropdown on the right. Dropdown
// options are grouped by fund so the portfolio
// structure stays visible even in the compact UI.
// ═══════════════════════════════════════════════

import { FUNDS, facilitiesInFund } from '../config/funds';
import { ALL_HOMES } from '../config/facilities';

export default function AlmFacilityFilter({ value, onChange }) {
  const isAll       = value.type === 'all';
  const activeFund  = value.type === 'fund' ? value.value : null;
  const activeFac   = value.type === 'facility' ? value.value : '';

  const onSelectFacility = (e) => {
    const v = e.target.value;
    if (!v) onChange({ type: 'all' });
    else    onChange({ type: 'facility', value: v });
  };

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

      <select
        value={activeFac}
        onChange={onSelectFacility}
        className="alm-select"
        aria-label="Filter by facility"
      >
        <option value="">Any facility</option>
        {FUNDS.map((fund) => {
          const homesInFund = facilitiesInFund(fund.id, ALL_HOMES);
          if (homesInFund.length === 0) return null;
          return (
            <optgroup key={fund.id} label={fund.label}>
              {homesInFund.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
