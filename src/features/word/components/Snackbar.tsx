import { useEffect } from 'react';

interface SnackbarProps {
  message: string;
  onClose: () => void;
}

export function Snackbar({ message, onClose }: SnackbarProps) {
  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="snackbar" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="snackbar-close" aria-label="通知を閉じる" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

