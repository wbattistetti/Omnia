import { describe, expect, it } from 'vitest';
import { isFlowInterfacePanelEnabled } from '../flowInterfaceUiPolicy';

describe('flowInterfaceUiPolicy', () => {
  it('hides Interface only for main', () => {
    expect(isFlowInterfacePanelEnabled('main')).toBe(false);
    expect(isFlowInterfacePanelEnabled('subflow_x')).toBe(true);
    expect(isFlowInterfacePanelEnabled('taskflow_1')).toBe(true);
  });
});
