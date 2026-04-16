// ═══════════════════════════════════════════════
// ALM — Toast
// ═══════════════════════════════════════════════

import useAlmUiStore from '../stores/almUiStore';

export default function AlmToast() {
  const msg = useAlmUiStore((s) => s.toastMsg);
  const visible = useAlmUiStore((s) => s.toastVisible);

  if (!msg) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        background: 'var(--alm-surface)',
        border: '1px solid var(--alm-border)',
        borderRadius: 6,
        padding: '10px 20px',
        fontSize: 12,
        color: 'var(--alm-ink-1)',
        boxShadow: '0 4px 18px rgba(20, 30, 50, 0.08)',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s ease',
        pointerEvents: 'none',
      }}
    >
      {msg}
    </div>
  );
}
