import { useEffect, useCallback } from 'react';

// ============================================================================
// KEYBOARD SHORTCUTS HOOK
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description?: string;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  target?: HTMLElement | null;
}

/**
 * Custom hook for handling keyboard shortcuts
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) => {
  const { enabled = true, target } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      console.log('[KeyboardShortcuts] Key pressed:', {
        key: event.key,
        enabled,
        target: event.target
      });

      if (!enabled) return;

      // Find matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        return (
          shortcut.key.toLowerCase() === event.key.toLowerCase() &&
          !!shortcut.ctrlKey === event.ctrlKey &&
          !!shortcut.shiftKey === event.shiftKey &&
          !!shortcut.altKey === event.altKey &&
          !!shortcut.metaKey === event.metaKey
        );
      });

      if (matchingShortcut) {
        console.log('[KeyboardShortcuts] Shortcut triggered:', {
          key: event.key,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          description: matchingShortcut.description
        });
        
        event.preventDefault();
        event.stopPropagation();
        matchingShortcut.action();
      } else {
        console.log('[KeyboardShortcuts] No matching shortcut found for key:', event.key);
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    const targetElement = target || document;
    
    if (enabled) {
      targetElement.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled, target]);
};

// ============================================================================
// COMMON KEYBOARD SHORTCUTS
// ============================================================================

/**
 * Common keyboard shortcuts for video editing
 */
export const COMMON_SHORTCUTS = {
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  SPACE: ' ',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  A: 'a',
  C: 'c',
  V: 'v',
  X: 'x',
  Z: 'z',
  Y: 'y',
} as const;

/**
 * Modifier keys
 */
export const MODIFIERS = {
  CTRL: { ctrlKey: true },
  SHIFT: { shiftKey: true },
  ALT: { altKey: true },
  META: { metaKey: true },
  CTRL_SHIFT: { ctrlKey: true, shiftKey: true },
  CTRL_ALT: { ctrlKey: true, altKey: true },
  META_SHIFT: { metaKey: true, shiftKey: true },
} as const;
