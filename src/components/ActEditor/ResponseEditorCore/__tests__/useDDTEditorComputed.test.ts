import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditorComputed } from '../useDDTEditorComputed';

// Mock delle dipendenze
vi.mock('../ResponseEditor/treeFactories', () => ({
  estraiNodiDaDDT: vi.fn()
}));

describe('useEditorComputed', () => {
  const mockDDT = {
    mainData: {
      steps: [{ type: 'start' }],
      subData: [
        { steps: [{ type: 'sub1' }] },
        { steps: [{ type: 'sub2' }] }
      ]
    }
  };

  const mockTranslations = { 'key1': 'value1' };
  const mockLang = 'it';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selectedNode calculation', () => {
    it('should return mainData when selectedNodeIndex is null', () => {
      const { result } = renderHook(() => 
        useEditorComputed(mockDDT, mockTranslations, mockLang, null, [], 'start')
      );

      expect(result.current.selectedNode).toBe(mockDDT.mainData);
    });

    it('should return subData[index] when selectedNodeIndex is valid', () => {
      const { result } = renderHook(() => 
        useEditorComputed(mockDDT, mockTranslations, mockLang, 1, [], 'start')
      );

      expect(result.current.selectedNode).toBe(mockDDT.mainData.subData[1]);
    });

    it('should return mainData when subData[index] does not exist', () => {
      const { result } = renderHook(() => 
        useEditorComputed(mockDDT, mockTranslations, mockLang, 999, [], 'start')
      );

      expect(result.current.selectedNode).toBe(mockDDT.mainData);
    });

    it('should return null when ddt.mainData is not available', () => {
      const { result } = renderHook(() => 
        useEditorComputed({}, mockTranslations, mockLang, null, [], 'start')
      );

      expect(result.current.selectedNode).toBeNull();
    });
  });

  describe('filteredNodes calculation', () => {
    it('should return empty array when no selectedStep', () => {
      const { result } = renderHook(() => 
        useEditorComputed(mockDDT, mockTranslations, mockLang, null, [], '')
      );

      expect(result.current.filteredNodes).toEqual([]);
    });

    it('should filter nodes for start step (level 0, no parentId)', () => {
      const nodes = [
        { id: '1', level: 0, parentId: null, stepType: 'start', type: 'action' },
        { id: '2', level: 1, parentId: '1', stepType: 'start', type: 'action' },
        { id: '3', level: 0, parentId: null, stepType: 'other', type: 'action' }
      ];

      const { result } = renderHook(() => 
        useEditorComputed(mockDDT, mockTranslations, mockLang, null, nodes, 'start')
      );

      expect(result.current.filteredNodes).toEqual([
        { id: '1', level: 0, parentId: null, stepType: 'start', type: 'action' }
      ]);
    });

    it('should filter nodes for success step (level 0, no parentId)', () => {
      const nodes = [
        { id: '1', level: 0, parentId: null, stepType: 'success', type: 'action' },
        { id: '2', level: 1, parentId: '1', stepType: 'success', type: 'action' }
      ];

      const { result } = renderHook(() => 
        useEditorComputed(mockDDT, mockTranslations, mockLang, null, nodes, 'success')
      );

      expect(result.current.filteredNodes).toEqual([
        { id: '1', level: 0, parentId: null, stepType: 'success', type: 'action' }
      ]);
    });

    it('should filter nodes by stepType for other steps', () => {
      const nodes = [
        { id: '1', level: 0, parentId: null, stepType: 'noMatch', type: 'action' },
        { id: '2', level: 1, parentId: '1', stepType: 'noMatch', type: 'action' },
        { id: '3', level: 0, parentId: null, stepType: 'other', type: 'action' }
      ];

      const { result } = renderHook(() => 
        useEditorComputed(mockDDT, mockTranslations, mockLang, null, nodes, 'noMatch')
      );

      expect(result.current.filteredNodes).toEqual([
        { id: '1', level: 0, parentId: null, stepType: 'noMatch', type: 'action' },
        { id: '2', level: 1, parentId: '1', stepType: 'noMatch', type: 'action' }
      ]);
    });
  });
}); 