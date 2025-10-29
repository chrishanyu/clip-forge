# ClipForge MVP - Clip Selection Implementation Tasks

## Relevant Files

- `src/stores/timelineStore.ts` - Timeline store with selection state management (COMPLETED)
- `src/stores/timelineStore.test.ts` - Unit tests for timeline store selection functionality (COMPLETED)
- `src/components/Timeline/TimelineClip.tsx` - Timeline clip component with selection highlighting (COMPLETED)
- `src/components/Timeline/TimelineClip.test.tsx` - Unit tests for timeline clip selection (COMPLETED)
- `src/components/Timeline/Timeline.tsx` - Main timeline component that needs keyboard handling
- `src/components/Timeline/Timeline.test.tsx` - Unit tests for timeline keyboard interactions
- `src/hooks/useKeyboardShortcuts.ts` - Custom hook for keyboard shortcut handling (COMPLETED)
- `src/hooks/useKeyboardShortcuts.test.ts` - Unit tests for keyboard shortcuts (COMPLETED)
- `src/components/Timeline/TimelineTrack.tsx` - Timeline track component with empty area deselection (COMPLETED)
- `src/components/Timeline/TimelineTrack.test.tsx` - Unit tests for timeline track click handling (COMPLETED)

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npm run test:run` to run tests. Running without a path executes all tests found by the Vitest configuration.

## Tasks

- [x] 1.0 Implement selection state management in timeline store
  - [x] 1.1 Add `selectedClipId: string | null` property to timeline store state
  - [x] 1.2 Implement `selectClip(id: string)` action to select a specific clip
  - [x] 1.3 Implement `deselectClip()` action to clear current selection
  - [x] 1.4 Implement `clearSelection()` action as alias for deselectClip
  - [x] 1.5 Add `isClipSelected(id: string)` computed property to check selection state
  - [x] 1.6 Update existing timeline operations to handle selection state changes
  - [x] 1.7 Write unit tests for all selection state management functions
  - [x] 1.8 Test selection state persistence during zoom and scroll operations

- [x] 2.0 Add visual highlighting to timeline clip component
  - [x] 2.1 Add `isSelected` prop to TimelineClip component interface
  - [x] 2.2 Create CSS classes for selected and unselected clip states
  - [x] 2.3 Implement visual highlighting using border color (#3B82F6) for selected clips
  - [x] 2.4 Ensure selected clips are visually distinct from unselected clips
  - [x] 2.5 Add smooth transition effects for selection state changes
  - [x] 2.6 Test highlighting visibility during timeline zoom and scroll
  - [x] 2.7 Write unit tests for TimelineClip selection visual states
  - [x] 2.8 Verify accessibility contrast requirements for selected state

- [x] 3.0 Implement click handling for clip selection
  - [x] 3.1 Add click event handler to TimelineClip component
  - [x] 3.2 Implement single-click selection logic (clear previous, select new)
  - [x] 3.3 Prevent event bubbling to avoid timeline interactions
  - [x] 3.4 Add click handler to TimelineTrack for empty area deselection
  - [x] 3.5 Clear selection when clicking on empty timeline areas
  - [x] 3.6 Ensure selection works with existing drag-and-drop functionality
  - [x] 3.7 Write unit tests for click selection behavior
  - [x] 3.8 Test selection behavior with multiple clips on timeline

- [x] 4.0 Add keyboard deletion functionality
  - [x] 4.1 Create useKeyboardShortcuts hook for Delete key handling
  - [x] 4.2 Add Delete key event listener to Timeline component
  - [x] 4.3 Implement deleteSelectedClip action in timeline store
  - [x] 4.4 Handle Delete key press when no clip is selected (no action)
  - [x] 4.5 Clear selection after successful deletion
  - [x] 4.6 Ensure deleted clips remain in media library
  - [x] 4.7 Add proper focus management for keyboard interactions
  - [x] 4.8 Write unit tests for keyboard deletion functionality
  - [x] 4.9 Test deletion with various timeline states and clip positions

- [x] 5.0 Integrate selection with existing timeline features
  - [x] 5.1 Update trim handle visibility to only show on selected clips
  - [x] 5.2 Disable trim handles on unselected clips
  - [x] 5.3 Clear selection when user starts dragging any clip
  - [x] 5.4 Update TimelineClip component to receive selection state from store
  - [x] 5.5 Connect Timeline component to timeline store selection state
  - [x] 5.6 Ensure selection state updates trigger proper re-renders
  - [x] 5.7 Test integration with existing timeline operations (zoom, scroll, playback)
  - [x] 5.8 Write integration tests for selection with trim and drag functionality
  - [x] 5.9 Verify selection behavior during video playback
  - [x] 5.10 Test selection state when clips are added or removed from timeline
