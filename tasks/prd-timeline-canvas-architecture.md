# PRD: Timeline Canvas Architecture

## Introduction/Overview

The current timeline implementation has a fundamental architectural issue where video clips are positioned using absolute pixel coordinates that exceed their parent container's width. For example, a 3-minute clip renders at 17,849px width while the track-content container is only 866px wide, causing clips to overflow and breaking horizontal scrolling behavior.

This PRD defines a canvas-based timeline architecture that establishes an explicit coordinate space for the timeline, ensuring proper clip positioning and scrolling behavior. This implementation follows industry standards used in professional video editing software like Premiere Pro, Final Cut Pro, and DaVinci Resolve.

**Goal**: Implement a scalable timeline canvas that dynamically adjusts its width based on content duration, providing a proper coordinate space for clip positioning and enabling correct scrolling behavior.

## Goals

1. Establish an explicit timeline canvas coordinate system that all timeline elements use consistently
2. Enable proper horizontal scrolling for timelines with content extending beyond viewport width
3. Automatically adjust timeline width based on clip content (add/remove/move operations)
4. Provide a minimum timeline duration (60 seconds) even when empty, giving users a visual canvas
5. Add buffer space (30 seconds) after the rightmost clip for easy timeline extension
6. Maintain visual consistency between time ruler, clips, and playhead positioning

## User Stories

1. **As a video editor**, I want to drop a 3-minute clip onto the timeline so that it appears at the correct position where I dropped it and I can scroll to see the entire clip.

2. **As a video editor**, I want to see at least 60 seconds of timeline space when the timeline is empty so that I have a clear landing zone for my first clip and understand the scale.

3. **As a video editor**, I want the timeline to automatically grow when I add clips beyond the current visible area so that I don't have to manually adjust the timeline size.

4. **As a video editor**, I want to see some empty space (30 seconds) after my last clip so that I can easily extend my timeline or see where the content ends.

5. **As a video editor**, I want the timeline to shrink when I delete the rightmost clips so that I'm not scrolling through empty space, but still maintain a minimum 60-second canvas.

6. **As a video editor**, I want clips, time ruler, and playhead to always align perfectly so that I can accurately position and trim my content.

## Functional Requirements

### FR1: Timeline Canvas Container
1.1. The system must create a `timeline-canvas` container element that wraps all timeline content (time ruler, playhead, tracks).

1.2. The timeline-canvas must have an explicit width calculated based on content duration and configuration constants.

1.3. The timeline-canvas must be positioned relatively within the scrollable timeline-content viewport.

### FR2: Dynamic Width Calculation
2.1. The system must calculate the rightmost point of all clips across all tracks (contentEndTime).

2.2. The system must calculate timeline duration as: `max(MIN_DURATION, contentEndTime + BUFFER_DURATION)` where:
   - MIN_DURATION = 60 seconds (minimum visible timeline)
   - BUFFER_DURATION = 30 seconds (empty space after content)

2.3. The system must calculate canvas width as: `timelineDuration × PIXELS_PER_SECOND` where PIXELS_PER_SECOND = 100.

2.4. The system must recalculate canvas width whenever:
   - A clip is added to any track
   - A clip is removed from any track
   - A clip is moved to a new position
   - A clip duration changes (trim operations)

### FR3: TimelineStore Updates
3.1. The timelineStore must track `contentEndTime` as a computed value representing the rightmost clip end time.

3.2. The timelineStore must track `timelineDuration` as a computed value following the formula in FR2.2.

3.3. The timelineStore must update these values automatically whenever clips are modified through any action (add, remove, move, trim).

3.4. If no clips exist, `contentEndTime` must be 0 and `timelineDuration` must be MIN_DURATION (60 seconds).

### FR4: Component Structure
4.1. The Timeline component must render structure:
```
timeline-content (scrollable, ref'd for scroll position)
  └─ timeline-canvas (explicit width)
      ├─ TimeRuler
      ├─ PlayheadIndicator
      └─ TimelineTracks
          └─ TimelineTrack (per track)
              ├─ track-header (fixed 200px)
              └─ track-content (flex: 1, contains clips)
```

4.2. The TimeRuler must render time markers based on timelineDuration (not a hardcoded maximum).

4.3. All track-content elements must inherit width from timeline-canvas (100% of canvas width).

4.4. Clips must position absolutely within track-content using: `left = startTime × PIXELS_PER_SECOND`.

### FR5: Minimum Timeline Duration
5.1. The timeline must always display at least 60 seconds of width, even when no clips are present.

5.2. The time ruler must show markers from 0:00 to at least 1:00 when empty.

5.3. Users must be able to see and drop clips anywhere in the first 60 seconds of an empty timeline.

### FR6: Content Buffer Space
6.1. The system must add 30 seconds of empty space after the rightmost clip.

6.2. This buffer space must be visible and scrollable, allowing users to extend their timeline easily.

6.3. The buffer space must not be fixed - it moves as clips are added/removed.

### FR7: Timeline Shrinking Behavior
7.1. When clips are deleted, the timeline must recalculate and shrink to fit remaining content + buffer.

7.2. The timeline must never shrink below the minimum duration (60 seconds).

7.3. Timeline shrinking must be smooth and not cause jarring scroll position jumps.

### FR8: Coordinate System Consistency
8.1. All positioning calculations must use the same formula: `pixels = time × PIXELS_PER_SECOND`.

8.2. Drop position calculations must account for:
   - Track header offset (200px)
   - Timeline scroll position
   - Relative positioning to track-content (not timeline-track)

8.3. The existing `mouseToTimelineTime()` helper in Timeline.tsx must remain the canonical way to convert viewport coordinates to timeline time.

## Non-Goals (Out of Scope)

1. **Zoom functionality** - Timeline zoom has been removed; all calculations use fixed PIXELS_PER_SECOND = 100.

2. **Performance optimization** - Virtual scrolling, canvas rendering, or other performance optimizations for large clip counts.

3. **Mini-map or overview** - No timeline overview or navigation mini-map.

4. **Maximum duration enforcement** - No need to handle clips longer than 10 minutes or timelines longer than reasonable limits.

5. **Edge case handling** - No special handling for extreme scenarios (very long clips, many clips, etc.).

6. **Smooth animations** - Timeline width changes happen immediately, no transition animations.

7. **Grid snapping** - No changes to existing snap-to-grid functionality.

## Design Considerations

### Visual Behavior
- Empty timeline shows a clear 60-second canvas with time markers
- Timeline grows naturally as content is added
- Scrollbar appears when content exceeds viewport width
- Buffer space after content is visually distinct (uses same background pattern)

### CSS Updates Required
```css
.timeline-canvas {
  position: relative;
  min-height: 100%;
  /* Width set dynamically via inline style */
}

.track-content {
  position: relative;
  flex: 1;
  min-height: 60px;
  width: 100%; /* Inherits from timeline-canvas */
}
```

### Constants
```typescript
const TIMELINE_CONFIG = {
  MIN_VISIBLE_DURATION: 60,    // Always show at least 60 seconds
  BUFFER_AFTER_CONTENT: 30,    // 30 seconds of empty space after last clip
  BASE_PIXELS_PER_SECOND: 100  // Fixed pixels per second (zoom removed)
};
```

## Technical Considerations

### Implementation Order
1. Update TimelineStore to track contentEndTime and timelineDuration
2. Add timeline-canvas container to Timeline.tsx
3. Update width calculation and pass to canvas
4. Update TimeRuler to use timelineDuration instead of hardcoded 600s
5. Verify drop position calculations still work correctly
6. Test clip add/remove triggers proper width recalculation

### State Management
- contentEndTime and timelineDuration should be computed values in TimelineStore
- Updated via helper function called by all clip-modifying actions
- No need for separate actions - computed on every state change

### Dependencies
- Existing drop position fix (track header offset, scroll position)
- Existing TimelineStore clip management actions
- Existing TimeRuler and Timeline components

### Breaking Changes
- None - this is an internal architecture change
- Existing components continue to work with enhanced container

## Success Metrics

### Functional Success Criteria
1. ✅ Empty timeline displays exactly 60 seconds of width with time markers 0:00 to 1:00
2. ✅ Dropping a 3-minute clip results in timeline width of ~3:30 (3min + 30s buffer)
3. ✅ Clips position correctly at their intended drop location (no offset errors)
4. ✅ Horizontal scrolling works smoothly when content exceeds viewport
5. ✅ Timeline shrinks when rightmost clips are deleted (but not below 60s)
6. ✅ Time ruler, clips, and playhead remain pixel-perfect aligned
7. ✅ Adding clips beyond current timeline end extends the timeline automatically
8. ✅ Track-content containers no longer have clips overflowing their bounds

### Testing Scenarios
**Scenario 1: Empty Timeline**
- Open app → Timeline shows 60 seconds width
- Time ruler displays 0:00, 0:10, 0:20... up to 1:00
- No scrollbar present (fits in viewport)

**Scenario 2: Add First Clip (3 minutes)**
- Drop 3-minute clip at start
- Timeline grows to 3:30 (210 seconds)
- Clip positioned at left edge
- Scrollbar appears if viewport < 210s width
- Time ruler shows up to 3:30

**Scenario 3: Add Second Clip Beyond First**
- Add 2-minute clip starting at 4:00
- Timeline grows to 6:30 (4min + 2min + 30s buffer)
- Both clips visible and positioned correctly
- Can scroll to see all content

**Scenario 4: Delete Rightmost Clip**
- Delete the clip ending at 6:00
- Timeline shrinks back to first clip's end + buffer (3:30)
- Scroll position adjusts if necessary
- No empty scrollable space beyond 3:30

**Scenario 5: Delete All Clips**
- Remove all clips
- Timeline shrinks to minimum 60 seconds
- Time ruler shows 0:00 to 1:00
- Scrollbar disappears

### Technical Success Criteria
1. ✅ Console logs show correct drop position calculations (no header offset issues)
2. ✅ Canvas width updates automatically on clip operations
3. ✅ No console errors related to positioning or measurements
4. ✅ DevTools inspector shows track-content width matches canvas width
5. ✅ Clip inline styles show left positions within parent bounds

## Open Questions

None - all requirements are clearly defined based on professional video editing software standards.

---

**Target Audience**: Junior Developer
**Complexity**: Medium - Requires understanding of coordinate systems and dynamic layouts
**Estimated Implementation Time**: 4-6 hours
**Priority**: High - Blocks correct timeline functionality

