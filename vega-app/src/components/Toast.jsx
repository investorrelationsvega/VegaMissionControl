import { useEffect } from 'react';
import useUiStore from '../stores/uiStore';

export default function Toast() {
  const toast = useUiStore((state) => state.toast);
  const hideToast = useUiStore((state) => state.hideToast);

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        hideToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible, hideToast]);

  return (
    <div className={`toast${toast.visible ? ' show' : ''}`}>
      {toast.message}
    </div>
  );
}
