import { describe, it, expect, vi } from 'vitest';
import type {
  TreeViewProps,
  TreeRendererProps,
  DropPreviewProps,
  CustomDragLayerProps,
  UseTreeDragDropProps,
  UseTreeDragDropReturn
} from '@responseEditor/TreeView/TreeViewTypes';

describe('TreeViewTypes', () => {
  it('should have TreeViewProps interface with required properties', () => {
    const props: TreeViewProps = {
      nodes: [],
      onDrop: vi.fn(),
      onRemove: vi.fn(),
      onToggleInclude: vi.fn(),
      bgColor: '#ffffff',
      foreColor: '#000000',
      stepKey: 'test',
      onAddEscalation: vi.fn()
    };

    expect(props.nodes).toBeDefined();
    expect(props.onDrop).toBeDefined();
    expect(props.onRemove).toBeDefined();
    expect(typeof props.onToggleInclude).toBe('function');
    expect(typeof props.bgColor).toBe('string');
    expect(typeof props.foreColor).toBe('string');
    expect(typeof props.stepKey).toBe('string');
    expect(typeof props.onAddEscalation).toBe('function');
  });

  it('should have TreeRendererProps interface with required properties', () => {
    const props: TreeRendererProps = {
      nodes: [],
      parentId: undefined,
      level: 0,
      selectedNodeId: null,
      onDrop: vi.fn(),
      onRemove: vi.fn(),
      setSelectedNodeId: vi.fn(),
      stepKey: 'test',
      extraProps: { bgColor: '#ffffff' },
      singleEscalationSteps: ['start', 'success']
    };

    expect(props.nodes).toBeDefined();
    expect(props.parentId).toBeUndefined();
    expect(props.level).toBe(0);
    expect(props.selectedNodeId).toBeNull();
    expect(typeof props.onDrop).toBe('function');
    expect(typeof props.onRemove).toBe('function');
    expect(typeof props.setSelectedNodeId).toBe('function');
  });

  it('should have DropPreviewProps interface with required properties', () => {
    const props: DropPreviewProps = {
      dropPreviewIdx: 0,
      dropPreviewPosition: 'before',
      nodes: []
    };

    expect(props.dropPreviewIdx).toBe(0);
    expect(props.dropPreviewPosition).toBe('before');
    expect(props.nodes).toBeDefined();
  });

  it('should have CustomDragLayerProps interface with required properties', () => {
    const props: CustomDragLayerProps = {
      nodes: []
    };

    expect(props.nodes).toBeDefined();
  });

  it('should have UseTreeDragDropProps interface with required properties', () => {
    const props: UseTreeDragDropProps = {
      nodes: [],
      onDrop: vi.fn(),
      containerRef: { current: null },
      setSelectedNodeId: vi.fn()
    };

    expect(props.nodes).toBeDefined();
    expect(typeof props.onDrop).toBe('function');
    expect(props.containerRef).toBeDefined();
    expect(typeof props.setSelectedNodeId).toBe('function');
  });

  it('should have UseTreeDragDropReturn interface with required properties', () => {
    const returnValue: UseTreeDragDropReturn = {
      isOver: false,
      dropPreviewIdx: null,
      dropPreviewPosition: null,
      setDropPreviewIdx: vi.fn(),
      setDropPreviewPosition: vi.fn()
    };

    expect(typeof returnValue.isOver).toBe('boolean');
    expect(returnValue.dropPreviewIdx).toBeNull();
    expect(returnValue.dropPreviewPosition).toBeNull();
    expect(typeof returnValue.setDropPreviewIdx).toBe('function');
    expect(typeof returnValue.setDropPreviewPosition).toBe('function');
  });
});