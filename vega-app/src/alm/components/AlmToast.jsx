// ═══════════════════════════════════════════════
// ALM — Toast Component (self-contained)
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
        background: 'var(--bg1)',
        border: '1px solid var(--grn)',
        borderRadius: 6,
        padding: '10px 20px',
        fontFamily: "'Space Mono', monospace",
        fontSize: 12,
        color: 'var(--grn)',
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
