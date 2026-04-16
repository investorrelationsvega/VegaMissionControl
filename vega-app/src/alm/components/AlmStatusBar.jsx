// ═══════════════════════════════════════════════
// ALM — Status Bar
// Last-synced + refresh, styled in the Vega mono idiom.
// ═══════════════════════════════════════════════

import { fmtRelative } from '../utils/format';

export default function AlmStatusBar({ loading, error, lastSynced, onRefresh }) {
  const syncedAt = lastSynced ? new Date(lastSynced) : null;

  return (
    <div
      className="alm-mono"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        fontSize: 11,
        color: 'var(--alm-ink-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        padding: '0 0 20px',
        marginBottom: 20,
        borderBottom: '1px solid var(--alm-border)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: error ? 'var(--alm-down)' : loading ? 'var(--alm-ink-5)' : 'var(--alm-accent)',
          }}
        />
        {loading
          ? 'Syncing…'
          : error
            ? <span style={{ color: 'var(--alm-down)' }}>Error · {error}</span>
            : syncedAt
              ? `Synced ${fmtRelative(syncedAt)}`
              : 'Not synced'}
      </span>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="alm-mono"
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          background: 'transparent',
          border: '1px solid var(--alm-border)',
          color: 'var(--alm-ink-3)',
          padding: '5px 12px',
          borderRadius: 3,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.5 : 1,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = 'var(--alm-border-strong)'; e.currentTarget.style.color = 'var(--alm-ink-1)'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--alm-border)'; e.currentTarget.style.color = 'var(--alm-ink-3)'; }}
      >
        Refresh
      </button>
    </div>
  );
}
