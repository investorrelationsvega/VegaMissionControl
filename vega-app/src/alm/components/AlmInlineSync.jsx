// ═══════════════════════════════════════════════
// ALM — Inline Sync Status
// Compact sync indicator + refresh button for
// nesting inside the page header rather than a
// dedicated row. Keeps the header block as a
// single glance-able unit.
// ═══════════════════════════════════════════════

import { fmtRelative } from '../utils/format';

export default function AlmInlineSync({ loading, error, lastSynced, onRefresh, dateLabel }) {
  const dotClass = error
    ? 'alm-sync__dot alm-sync__dot--error'
    : loading
      ? 'alm-sync__dot alm-sync__dot--loading'
      : 'alm-sync__dot';

  const label = loading
    ? 'Syncing…'
    : error
      ? `Error · ${error}`
      : lastSynced
        ? `Synced ${fmtRelative(new Date(lastSynced))}`
        : 'Not synced';

  return (
    <div className="alm-page-header__status">
      {dateLabel && <span className="alm-status-date">{dateLabel}</span>}
      {dateLabel && <span className="alm-status-sep" />}
      <span className="alm-sync">
        <span className={dotClass} />
        {label}
      </span>
      <button className="alm-refresh-btn" onClick={onRefresh} disabled={loading}>
        Refresh
      </button>
    </div>
  );
}
