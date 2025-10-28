import React, { useEffect } from 'react';
import './Toast.css';

// ============================================================================
// TOAST TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

export const ToastComponent: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const { id, type, title, message, duration = 5000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  const handleClick = () => {
    onRemove(id);
  };

  return (
    <div
      className={`toast toast-${type}`}
      onClick={handleClick}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-content">
        <div className="toast-icon">
          {type === 'success' && '✓'}
          {type === 'error' && '✕'}
          {type === 'warning' && '⚠'}
          {type === 'info' && 'ℹ'}
        </div>
        <div className="toast-text">
          <div className="toast-title">{title}</div>
          {message && <div className="toast-message">{message}</div>}
        </div>
        <button
          className="toast-close"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// TOAST CONTAINER
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[];
  onRemoveToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemoveToast,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onRemove={onRemoveToast}
        />
      ))}
    </div>
  );
};
