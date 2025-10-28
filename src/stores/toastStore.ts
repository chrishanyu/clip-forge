import { create } from 'zustand';
import { Toast, ToastType } from '@/components/Toast/Toast';

// ============================================================================
// TOAST STORE
// ============================================================================

interface ToastStore {
  toasts: Toast[];
  
  // Actions
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  // Convenience methods
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
    };
    
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  
  clearToasts: () => {
    set({ toasts: [] });
  },
  
  showSuccess: (title: string, message?: string) => {
    get().addToast({ type: 'success', title, message });
  },
  
  showError: (title: string, message?: string) => {
    get().addToast({ type: 'error', title, message });
  },
  
  showWarning: (title: string, message?: string) => {
    get().addToast({ type: 'warning', title, message });
  },
  
  showInfo: (title: string, message?: string) => {
    get().addToast({ type: 'info', title, message });
  },
}));
