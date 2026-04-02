import { describe, it, expect, beforeEach } from 'vitest';
import {
  persistWorkspaceRestoreForProject,
  takeWorkspaceRestoreForProjectOnce,
  clearWorkspaceRestoreForProject,
} from '../flowSaveSnapshot';

describe('post-draft workspace restore (memory + sessionStorage)', () => {
  const pid = 'proj_test123';

  beforeEach(() => {
    clearWorkspaceRestoreForProject(pid);
  });

  it('take prefers memory then consumes session on second take (Strict Mode)', () => {
    persistWorkspaceRestoreForProject(pid, {
      main: { nodes: [{ id: 'n1' }], edges: [], title: 'Main' },
    });
    const a = takeWorkspaceRestoreForProjectOnce(pid);
    expect(a?.main).toBeDefined();
    const b = takeWorkspaceRestoreForProjectOnce(pid);
    expect(b?.main).toBeDefined();
    expect(takeWorkspaceRestoreForProjectOnce(pid)).toBeNull();
  });

  it('ignores draft_ ids', () => {
    persistWorkspaceRestoreForProject('draft_x', { main: { nodes: [], edges: [] } });
    expect(takeWorkspaceRestoreForProjectOnce('draft_x')).toBeNull();
  });
});
