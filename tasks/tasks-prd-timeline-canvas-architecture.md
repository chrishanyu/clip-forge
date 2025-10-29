## Relevant Files

- `src/stores/timelineStore.ts` - Timeline state management; adding contentEndTime and timelineDuration computed properties
- `src/stores/timelineStore.test.ts` - Unit tests for timelineStore (if tests need updating)
- `src/components/Timeline/Timeline.tsx` - Main timeline component; adding timeline-canvas container
- `src/components/Timeline/Timeline.css` - Timeline styles; adding canvas-specific styles
- `src/components/Timeline/TimeRuler.tsx` - Time ruler component; updating to use dynamic duration instead of hardcoded 600s
- `src/components/Timeline/TimeRuler.css` - Time ruler styles (may need updates)
- `src/components/Timeline/TimelineTrack.css` - Track styles; updating track-content width behavior
- `src/types/timeline.ts` - Timeline type definitions (if new constants needed)

### Notes

- Focus on modifying existing files rather than creating new ones
- Timeline configuration constants (MIN_VISIBLE_DURATION, BUFFER_AFTER_CONTENT, BASE_PIXELS_PER_SECOND) will be added to Timeline.tsx or a constants file
- All positioning logic already exists and should continue to work with the new canvas container
- Test by manually verifying the 5 scenarios in the PRD success metrics section

## Tasks

- [x] 1.0 Update TimelineStore with computed timeline dimension properties
  - [x] 1.1 Add `contentEndTime` property to TimelineState interface (number, represents rightmost clip end time)
  - [x] 1.2 Add `timelineDuration` property to TimelineState interface (number, calculated timeline duration)
  - [x] 1.3 Create helper function `calculateTimelineDimensions()` that computes contentEndTime from all tracks/clips
  - [x] 1.4 Implement timelineDuration calculation: `Math.max(60, contentEndTime + 30)`
  - [x] 1.5 Update `addClipToTrack` action to recalculate dimensions after adding clip
  - [x] 1.6 Update `removeClipFromTrack` action to recalculate dimensions after removing clip
  - [x] 1.7 Update `moveClip` action to recalculate dimensions after moving clip
  - [x] 1.8 Update `trimClip` action to recalculate dimensions after trimming clip
  - [x] 1.9 Initialize contentEndTime to 0 and timelineDuration to 60 in initial state
  - [x] 1.10 Add console.log statements to verify dimensions update correctly

- [x] 2.0 Add timeline-canvas container to Timeline component
  - [x] 2.1 Define TIMELINE_CONFIG constants at top of Timeline.tsx (MIN_VISIBLE_DURATION=60, BUFFER_AFTER_CONTENT=30, PIXELS_PER_SECOND=100)
  - [x] 2.2 Import `timelineDuration` from useTimelineStore hook
  - [x] 2.3 Create `canvasWidth` useMemo that calculates: `timelineDuration * PIXELS_PER_SECOND`
  - [x] 2.4 Wrap TimeRuler, PlayheadIndicator, and TimelineTracks in a new `<div className="timeline-canvas">` container
  - [x] 2.5 Set timeline-canvas inline style: `style={{ width: canvasWidth + 'px' }}`
  - [x] 2.6 Ensure timeline-content ref remains on the scrollable container (not moved to canvas)
  - [x] 2.7 Verify existing mouseToTimelineTime() function still works correctly with new structure
  - [x] 2.8 Add console.log to show calculated canvasWidth for debugging

- [x] 3.0 Update TimeRuler to use dynamic timeline duration
  - [x] 3.1 Add `timelineDuration` prop to TimeRulerProps interface
  - [x] 3.2 Update Timeline.tsx to pass timelineDuration prop to TimeRuler component
  - [x] 3.3 Replace hardcoded maxTime=600 with `timelineDuration` in marker generation loop
  - [x] 3.4 Update marker generation to use: `for (let time = 0; time <= timelineDuration; time += interval)`
  - [x] 3.5 Remove or update maxPixels calculation to use timelineDuration instead of hardcoded value
  - [x] 3.6 Test that time markers appear correctly for both empty timeline (60s) and with content

- [x] 4.0 Update CSS for timeline-canvas architecture
  - [x] 4.1 Add `.timeline-canvas` class with `position: relative` and `min-height: 100%`
  - [x] 4.2 Update `.track-content` to have `width: 100%` (inherits from canvas instead of flex sizing)
  - [x] 4.3 Ensure `.track-content` maintains `position: relative` for absolute clip positioning
  - [x] 4.4 Verify `.timeline-content` remains scrollable with `overflow: auto`
  - [x] 4.5 Test that background grid pattern still displays correctly in track-content
  - [x] 4.6 Verify scrollbar appears when canvas width exceeds viewport

- [ ] 5.0 Test and verify all timeline scenarios
  - [ ] 5.1 Test Scenario 1: Empty timeline shows 60 seconds with time markers 0:00 to 1:00
  - [ ] 5.2 Test Scenario 2: Drop 3-minute clip → timeline grows to 3:30, clip positioned correctly
  - [ ] 5.3 Test Scenario 3: Add second clip beyond first → timeline extends, both clips visible
  - [ ] 5.4 Test Scenario 4: Delete rightmost clip → timeline shrinks but maintains minimum 60s
  - [ ] 5.5 Test Scenario 5: Delete all clips → timeline returns to 60s minimum
  - [ ] 5.6 Verify horizontal scrolling works smoothly when content exceeds viewport
  - [ ] 5.7 Verify time ruler, clips, and playhead remain pixel-perfect aligned
  - [ ] 5.8 Check DevTools inspector: track-content width should match canvas width
  - [ ] 5.9 Check DevTools inspector: clip left positions should be within parent bounds
  - [ ] 5.10 Verify no console errors related to positioning or measurements

