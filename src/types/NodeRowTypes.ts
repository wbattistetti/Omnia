export interface NodeRowProps {
  row: import('./project').NodeRowData;
  nodeTitle?: string;
  nodeCanvasPosition?: { x: number; y: number };
  onUpdate: (row: import('./project').NodeRowData, newText: string) => void;
  onUpdateWithCategory?: (row: import('./project').NodeRowData, newText: string, categoryType?: string) => void;
  onDelete: (row: import('./project').NodeRowData) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onDragStart?: (id: string, index: number, clientX: number, clientY: number, rect: DOMRect) => void;
  index: number;
  canDelete: boolean;
  totalRows: number;
  isHoveredTarget?: boolean;
  isBeingDragged?: boolean;
  isPlaceholder?: boolean;
  style?: React.CSSProperties;
  forceEditing?: boolean;
  onMouseEnter?: (type: 'top' | 'bottom', index: number) => void;
  onMouseLeave?: () => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  bgColor?: string;
  textColor?: string;
  onEditingEnd?: () => void;
} 