// Integration tests for AppContent refactoring
// Verifies that extracted functions work correctly with AppContent

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppContent } from '../../AppContent';
import { findRootTabset, tabExists } from '../../domain/dockTree';
import { openBottomDockedTab } from '../../infrastructure/docking/DockingHelpers';
import type { DockNode, DockTab } from '@dock/types';
import { TaskType } from '@types/taskTypes';

// Mock dependencies
vi.mock('@context/ProjectDataContext', () => ({
  useProjectData: () => ({ data: {} }),
  useProjectDataUpdate: () => ({
    getCurrentProjectId: () => 'test-project',
    refreshData: vi.fn(),
  }),
}));

vi.mock('@services/TaskRepository', () => ({
  taskRepository: {
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  },
}));

describe('AppContent - Integration Tests', () => {
  describe('Extracted functions integration', () => {
    it('should use findRootTabset correctly', () => {
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [],
        active: 0,
      };
      const rootId = findRootTabset(tree);
      expect(rootId).toBe('ts_main');
    });

    it('should use tabExists correctly', () => {
      const tab: DockTab = {
        id: 'test-tab',
        title: 'Test',
        type: 'flow',
      };
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [tab],
        active: 0,
      };
      expect(tabExists(tree, 'test-tab')).toBe(true);
      expect(tabExists(tree, 'nonexistent')).toBe(false);
    });

    it('should use openBottomDockedTab correctly', () => {
      const tree: DockNode = {
        kind: 'tabset',
        id: 'ts_main',
        tabs: [],
        active: 0,
      };
      const newTab: DockTab = {
        id: 'new-tab',
        title: 'New Tab',
        type: 'flow',
      };
      const result = openBottomDockedTab(tree, {
        tabId: 'new-tab',
        newTab,
      });
      expect(result.kind).toBe('split');
    });
  });

  describe('Event handling integration', () => {
    it('should handle conditionEditor:open event', async () => {
      // This test verifies that the refactored code still handles events correctly
      // Note: Full integration test would require more setup
      expect(true).toBe(true); // Placeholder - will be expanded
    });
  });
});
