import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from './useKeyboardShortcuts';

// Mock DOM events
const createKeyboardEvent = (key: string, options: Partial<KeyboardEvent> = {}) => {
  return new KeyboardEvent('keydown', {
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...options
  });
};

describe('useKeyboardShortcuts', () => {
  let mockAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAction = vi.fn();
  });

  it('should call action when matching key is pressed', () => {
    const shortcuts = [
      {
        key: COMMON_SHORTCUTS.DELETE,
        action: mockAction,
        description: 'Delete'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate Delete key press
    const event = createKeyboardEvent(COMMON_SHORTCUTS.DELETE);
    document.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('should not call action when non-matching key is pressed', () => {
    const shortcuts = [
      {
        key: COMMON_SHORTCUTS.DELETE,
        action: mockAction,
        description: 'Delete'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate different key press
    const event = createKeyboardEvent('a');
    document.dispatchEvent(event);

    expect(mockAction).not.toHaveBeenCalled();
  });

  it('should handle modifier keys correctly', () => {
    const shortcuts = [
      {
        key: 'a',
        ctrlKey: true,
        action: mockAction,
        description: 'Ctrl+A'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate Ctrl+A
    const event = createKeyboardEvent('a', { ctrlKey: true });
    document.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('should not call action when modifiers don\'t match', () => {
    const shortcuts = [
      {
        key: 'a',
        ctrlKey: true,
        action: mockAction,
        description: 'Ctrl+A'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate A without Ctrl
    const event = createKeyboardEvent('a', { ctrlKey: false });
    document.dispatchEvent(event);

    expect(mockAction).not.toHaveBeenCalled();
  });

  it('should prevent default and stop propagation when shortcut matches', () => {
    const shortcuts = [
      {
        key: COMMON_SHORTCUTS.DELETE,
        action: mockAction,
        description: 'Delete'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate Delete key press
    const event = createKeyboardEvent(COMMON_SHORTCUTS.DELETE);
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
    
    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it('should not register event listener when disabled', () => {
    const shortcuts = [
      {
        key: COMMON_SHORTCUTS.DELETE,
        action: mockAction,
        description: 'Delete'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, { enabled: false }));

    // Simulate Delete key press
    const event = createKeyboardEvent(COMMON_SHORTCUTS.DELETE);
    document.dispatchEvent(event);

    expect(mockAction).not.toHaveBeenCalled();
  });

  it('should clean up event listener on unmount', () => {
    const shortcuts = [
      {
        key: COMMON_SHORTCUTS.DELETE,
        action: mockAction,
        description: 'Delete'
      }
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    // Unmount the hook
    unmount();

    // Simulate Delete key press after unmount
    const event = createKeyboardEvent(COMMON_SHORTCUTS.DELETE);
    document.dispatchEvent(event);

    expect(mockAction).not.toHaveBeenCalled();
  });

  it('should handle multiple shortcuts', () => {
    const deleteAction = vi.fn();
    const escapeAction = vi.fn();

    const shortcuts = [
      {
        key: COMMON_SHORTCUTS.DELETE,
        action: deleteAction,
        description: 'Delete'
      },
      {
        key: COMMON_SHORTCUTS.ESCAPE,
        action: escapeAction,
        description: 'Escape'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Test Delete
    const deleteEvent = createKeyboardEvent(COMMON_SHORTCUTS.DELETE);
    document.dispatchEvent(deleteEvent);
    expect(deleteAction).toHaveBeenCalledTimes(1);

    // Test Escape
    const escapeEvent = createKeyboardEvent(COMMON_SHORTCUTS.ESCAPE);
    document.dispatchEvent(escapeEvent);
    expect(escapeAction).toHaveBeenCalledTimes(1);
  });
});
