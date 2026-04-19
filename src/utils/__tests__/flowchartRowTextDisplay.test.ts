import { describe, expect, it } from 'vitest';
import { formatFlowchartRowTextForViewer } from '../flowchartRowTextDisplay';

describe('formatFlowchartRowTextForViewer', () => {
  it('returns raw when flowCanvasId is empty (no mappings scope)', () => {
    expect(formatFlowchartRowTextForViewer('[x]', '')).toBe('[x]');
  });
});
