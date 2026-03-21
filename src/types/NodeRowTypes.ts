export interface NodeRowProps {
  nodeId?: string;
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
  onCreateFactoryTask?: (name: string, onRowUpdate?: (item: any) => void) => void; // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void) => void;
  getProjectId?: () => string | null;
  onWidthChange?: (width: number) => void;
  /** Opens a subflow tab for Flow-type rows (taskId, optional existingFlowId, optional title = row label) */
  onOpenSubflowForTask?: (taskId: string, existingFlowId?: string, title?: string) => void;
  /** Immutable update of all rows in this node (flowchart); required for row.meta draft fields */
  updateNodeRows?: (mutate: (rows: import('./project').NodeRowData[]) => import('./project').NodeRowData[]) => void;
  /** Generates child nodes/edges from semantic values of this row. */
  onAppendSemanticNodes?: (row: import('./project').NodeRowData, values: import('./taskTypes').SemanticValue[]) => Promise<void> | void;
  /** Nodo flow nascosto (ancora temporanea): niente toolbar/overlay riga portati nel body. */
  suppressRowToolbar?: boolean;
}