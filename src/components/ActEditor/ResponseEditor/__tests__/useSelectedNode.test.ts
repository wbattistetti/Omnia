import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectedNode } from '../useSelectedNode';

// Mock the treeFactories module
vi.mock('../treeFactories', () => ({
  estraiNodiDaDDT: vi.fn(() => []),
}));

describe('useSelectedNode', () => {
  const mockDispatch = vi.fn();
  const mockDDT = {
    mainData: {
      steps: [
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
      ],
      subData: [
        {
          steps: [
            { type: 'subStart', escalations: [] },
          ],
        },
      ],
    },
  };
  const mockTranslations = {};
  const mockLang = 'it';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with null selectedNodeIndex', () => {
    const { result } = renderHook(() =>
      useSelectedNode(mockDDT, mockDispatch, mockLang, mockTranslations)
    );

    expect(result.current.selectedNodeIndex).toBe(null);
    expect(result.current.selectedNode).toBe(mockDDT.mainData);
  });

  it('should handle selecting main node (index null)', () => {
    const { result } = renderHook(() =>
      useSelectedNode(mockDDT, mockDispatch, mockLang, mockTranslations)
    );

    act(() => {
      result.current.handleSelectNode(null);
    });

    expect(result.current.selectedNodeIndex).toBe(null);
    expect(result.current.selectedNode).toBe(mockDDT.mainData);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STEP',
      step: 'start',
    });
  });

  it('should handle selecting sub node (index 0)', () => {
    const { result } = renderHook(() =>
      useSelectedNode(mockDDT, mockDispatch, mockLang, mockTranslations)
    );

    act(() => {
      result.current.handleSelectNode(0);
    });

    expect(result.current.selectedNodeIndex).toBe(0);
    expect(result.current.selectedNode).toBe(mockDDT.mainData.subData[0]);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STEP',
      step: 'subStart',
    });
  });

  it('should handle selecting node without steps', () => {
    const ddtWithoutSteps = {
      mainData: {
        subData: [
          { noSteps: true },
        ],
      },
    };

    const { result } = renderHook(() =>
      useSelectedNode(ddtWithoutSteps, mockDispatch, mockLang, mockTranslations)
    );

    act(() => {
      result.current.handleSelectNode(0);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STEP',
      step: '',
    });
  });

  it('should handle selecting node with empty steps array', () => {
    const ddtWithEmptySteps = {
      mainData: {
        subData: [
          { steps: [] },
        ],
      },
    };

    const { result } = renderHook(() =>
      useSelectedNode(ddtWithEmptySteps, mockDispatch, mockLang, mockTranslations)
    );

    act(() => {
      result.current.handleSelectNode(0);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STEP',
      step: '',
    });
  });

  it('should handle selecting invalid index', () => {
    const { result } = renderHook(() =>
      useSelectedNode(mockDDT, mockDispatch, mockLang, mockTranslations)
    );

    act(() => {
      result.current.handleSelectNode(999);
    });

    expect(result.current.selectedNodeIndex).toBe(999);
    expect(result.current.selectedNode).toBe(mockDDT.mainData); // Falls back to mainData
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STEP',
      step: 'start', // mainData has steps, so first step is selected
    });
  });

  it('should handle ddt without mainData', () => {
    const ddtWithoutMainData = {};

    const { result } = renderHook(() =>
      useSelectedNode(ddtWithoutMainData, mockDispatch, mockLang, mockTranslations)
    );

    act(() => {
      result.current.handleSelectNode(0);
    });

    expect(result.current.selectedNode).toEqual({});
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STEP',
      step: '',
    });
  });

  it('should handle ddt without subData', () => {
    const ddtWithoutSubData = {
      mainData: {
        steps: [{ type: 'start' }],
      },
    };

    const { result } = renderHook(() =>
      useSelectedNode(ddtWithoutSubData, mockDispatch, mockLang, mockTranslations)
    );

    act(() => {
      result.current.handleSelectNode(0);
    });

    expect(result.current.selectedNode).toBe(ddtWithoutSubData.mainData);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STEP',
      step: 'start',
    });
  });
}); 