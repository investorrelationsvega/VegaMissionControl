import { useEffect } from 'react';
import useUiStore from '../stores/uiStore';

export default function Toast() {
  const toast = useUiStore((state) => state.toast);
  const hideToast = useUiStore((state) => state.hideToast);

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        hideToast();
      }, toast.onUndo ? 6000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible, toast.onUndo, hideToast]);

  return (
    <div className={`toast${toast.visible ? ' show' : ''}`}>
      <span>{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={() => {
            toast.onUndo();
            hideToast();
          }}
          style={{
            marginLeft: 12,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: 4,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
