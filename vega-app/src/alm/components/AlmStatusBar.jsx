// ═══════════════════════════════════════════════
// ALM — Status Bar
// Last-synced indicator + refresh button + error.
// ═══════════════════════════════════════════════

import { fmtRelative } from '../utils/format';

export default function AlmStatusBar({ loading, error, lastSynced, onRefresh }) {
  const syncedAt = lastSynced ? new Date(lastSynced) : null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        fontSize: 11,
        color: 'var(--alm-text-faint)',
        padding: '8px 0 20px',
        borderBottom: '1px solid var(--alm-border)',
        marginBottom: 24,
      }}
    >
      <span>
        {loading
          ? 'Loading from Google Sheet…'
          : error
            ? <span style={{ color: '#a04040' }}>Error: {error}</span>
            : syncedAt
              ? `Synced ${fmtRelative(syncedAt)}`
              : 'Not synced'}
      </span>
      <button
        onClick={onRefresh}
        disabled={loading}
        style={{
          fontSize: 11,
          background: 'transparent',
          border: '1px solid var(--alm-border)',
          color: 'var(--alm-text-muted)',
          padding: '4px 10px',
          borderRadius: 3,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.5 : 1,
        }}
      >
        Refresh
      </button>
    </div>
  );
}
