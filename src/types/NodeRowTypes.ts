export interface NodeRowProps {
  row: import('./project').NodeRowData;
  nodeTitle?: string;
  nodeCanvasPosition?: { x: number; y: number };
  onUpdate: (row: import('./project').NodeRowData, newText: string) => void;
  onUpdateWithCategory?: (row: import('./project').NodeRowData, newText: string, categoryType?: string, meta?: any) => void;
  onDelete: (row: import('./project').NodeRowData) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onDragStart?: (id: string, index: number, clientX: number, clientY: number, rect: DOMRect) => void; // legacy manual DnD
  onMoveRow?: (fromIndex: number, toIndex: number) => void; // react-dnd move
  onDropRow?: () => void; // react-dnd drop commit
  index: number;
  canDelete: boolean;
  totalRows: number;
  isHoveredTarget?: boolean;
  isBeingDragged?: boolean;
  isPlaceholder?: boolean;
  isDragSource?: boolean;
  style?: React.CSSProperties;
  forceEditing?: boolean;
  onMouseEnter?: (type: 'top' | 'bottom', index: number) => void;
  onMouseLeave?: () => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  bgColor?: string;
  textColor?: string;
  onEditingEnd?: () => void;
  onCreateAgentAct?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void) => void;
  getProjectId?: () => string | null;
}