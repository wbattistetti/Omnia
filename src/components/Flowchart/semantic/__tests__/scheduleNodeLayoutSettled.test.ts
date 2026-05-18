import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FLOW_CANVAS_SEMANTIC_EVENT,
  type FlowCanvasSemanticEvent,
} from '../flowCanvasSemanticEvents';
import { scheduleNodeLayoutSettled } from '../scheduleNodeLayoutSettled';

describe('scheduleNodeLayoutSettled', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits NODE_LAYOUT_SETTLED after 200ms debounce', () => {
    const events: FlowCanvasSemanticEvent[] = [];
    const listener = (e: Event) => {
      events.push((e as CustomEvent<FlowCanvasSemanticEvent>).detail);
    };
    window.addEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);

    scheduleNodeLayoutSettled('main', 'n1', 120, 80);
    expect(events).toHaveLength(0);

    vi.advanceTimersByTime(199);
    expect(events).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'NODE_LAYOUT_SETTLED',
      flowId: 'main',
      nodeId: 'n1',
      width: 120,
      height: 80,
    });

    window.removeEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);
  });

  it('ignores sub-epsilon churn during debounce (commits first stable size)', () => {
    const events: FlowCanvasSemanticEvent[] = [];
    const listener = (e: Event) => {
      events.push((e as CustomEvent<FlowCanvasSemanticEvent>).detail);
    };
    window.addEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);

    scheduleNodeLayoutSettled('main', 'n1', 100, 50);
    scheduleNodeLayoutSettled('main', 'n1', 101, 51);
    vi.advanceTimersByTime(200);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ width: 100, height: 50 });
    window.removeEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);
  });
});
