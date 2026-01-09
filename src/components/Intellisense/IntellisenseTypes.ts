export interface IntellisenseItem {
  id: string;
  label: string; // testo principale da mostrare
  shortLabel?: string; // opzionale, versione sintetica
  name: string;
  description: string;
  category: string;
  categoryType: 'taskTemplates' | 'userTasks' | 'backendActions' | 'conditions' | 'macrotasks';
  // Underlying entity identifiers
  factoryId?: string; // optional backend _id
  taskId: string; // ✅ REQUIRED: taskId (no backward compatibility)
  icon?: React.ReactNode;
  iconComponent?: React.ComponentType<any>;
  color?: string;
  // Task type (TaskType enum) - REQUIRED
  type: number; // ✅ TaskType enum (0-19)
  userTasks?: string[];
  uiColor?: string;
  bgColor?: string; // colore di sfondo personalizzato
  textColor?: string; // colore del testo personalizzato
  // Unified model extensions
  kind?: 'condition' | 'intent';
  payload?: any;
}

export interface IntellisenseCategory {
  id: string;
  name: string;
  type: 'taskTemplates' | 'userActs' | 'backendActions' | 'conditions' | 'macrotasks';
  items: IntellisenseItem[];
  icon?: React.ReactNode;
  color?: string;
}

export interface IntellisenseResult {
  item: IntellisenseItem;
  score?: number;
  matches?: Array<{
    indices: [number, number][];
    value: string;
    key: string;
  }>;
}

export interface IntellisenseSearchOptions {
  threshold: number;
  includeScore: boolean;
  includeMatches: boolean;
  keys: string[];
}

export interface IntellisenseMenuProps {
  isOpen: boolean;
  query: string;
  position: { x: number; y: number };
  referenceElement: HTMLElement | null;
  onSelect: (item: IntellisenseItem) => void;
  onClose: () => void;
}

export interface IntellisenseLayoutConfig {
  maxVisibleItems: number;
  itemHeight: number;
  categoryHeaderHeight: number;
  maxMenuHeight: number;
  maxMenuWidth: number;
}

export type IntellisenseSearchMode = 'fuzzy' | 'semantic' | 'hybrid';