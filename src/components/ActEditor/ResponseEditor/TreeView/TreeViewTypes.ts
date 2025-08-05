import { TreeNodeProps } from '../types';

export interface TreeViewProps {
  nodes: TreeNodeProps[];
  onDrop: (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => void;
  onRemove: (id: string) => void;
  onToggleInclude?: (id: string) => void;
  bgColor?: string;
  foreColor?: string;
  stepKey?: string;
  onAddEscalation?: () => void;
}

export interface TreeRendererProps {
  nodes: TreeNodeProps[];
  parentId: string | undefined;
  level: number;
  selectedNodeId: string | null;
  onDrop: TreeViewProps['onDrop'];
  onRemove: TreeViewProps['onRemove'];
  setSelectedNodeId: (id: string | null) => void;
  stepKey?: string;
  extraProps?: Partial<TreeViewProps> & { foreColor?: string; bgColor?: string; onToggleInclude?: (id: string) => void };
  singleEscalationSteps?: string[];
}

export interface DropPreviewProps {
  dropPreviewIdx: number | null;
  dropPreviewPosition: 'before' | 'after' | null;
  nodes: TreeNodeProps[];
}

export interface CustomDragLayerProps {
  nodes: TreeNodeProps[];
}

export interface UseTreeDragDropProps {
  nodes: TreeNodeProps[];
  onDrop: TreeViewProps['onDrop'];
  containerRef: React.RefObject<HTMLDivElement>;
  setSelectedNodeId: (id: string | null) => void;
}

export interface UseTreeDragDropReturn {
  isOver: boolean;
  dropPreviewIdx: number | null;
  dropPreviewPosition: 'before' | 'after' | null;
  setDropPreviewIdx: (idx: number | null) => void;
  setDropPreviewPosition: (position: 'before' | 'after' | null) => void;
} 