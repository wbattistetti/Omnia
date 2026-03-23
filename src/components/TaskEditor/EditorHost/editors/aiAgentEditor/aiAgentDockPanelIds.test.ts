/**
 * Header action visibility helpers: split groups after manual dock layout must not all show primary actions.
 */

import { describe, expect, it } from 'vitest';
import {
  AI_AGENT_DOCK_PANEL_IDS,
  dockGroupHasDesignAnchor,
  dockGroupHasUseCasesPanel,
} from './aiAgentDockPanelIds';

describe('dockGroupHasDesignAnchor', () => {
  it('is true for task description panel', () => {
    expect(dockGroupHasDesignAnchor([{ id: AI_AGENT_DOCK_PANEL_IDS.taskDesc }])).toBe(true);
  });

  it('is true for unified pre-gen panel', () => {
    expect(dockGroupHasDesignAnchor([{ id: AI_AGENT_DOCK_PANEL_IDS.unified }])).toBe(true);
  });

  it('is false for a lone structured section tab', () => {
    expect(dockGroupHasDesignAnchor([{ id: 'behavior_spec' }])).toBe(false);
  });
});

describe('dockGroupHasUseCasesPanel', () => {
  it('is true when use case panel is in the group', () => {
    expect(dockGroupHasUseCasesPanel([{ id: AI_AGENT_DOCK_PANEL_IDS.useCases }])).toBe(true);
  });

  it('is false for design-only groups', () => {
    expect(dockGroupHasUseCasesPanel([{ id: AI_AGENT_DOCK_PANEL_IDS.taskDesc }])).toBe(false);
  });
});
