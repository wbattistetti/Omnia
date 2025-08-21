export interface IntellisenseItem {
  id: string;
  label: string; // testo principale da mostrare
  shortLabel?: string; // opzionale, versione sintetica
  name: string;
  description: string;
  category: string;
  categoryType: 'agentActs' | 'userActs' | 'backendActions' | 'conditions' | 'tasks' | 'macrotasks';
  // Underlying entity identifiers
  actId?: string; // original item.id
  factoryId?: string; // optional backend _id
  icon?: React.ReactNode;
  iconComponent?: React.ComponentType<any>;
  color?: string;
  // Flag to indicate interactive agent act (asks user). Mirrors sidebar data.
  isInteractive?: boolean;
  userActs?: string[];
  uiColor?: string;
  bgColor?: string; // colore di sfondo personalizzato
  textColor?: string; // colore del testo personalizzato
}

export interface IntellisenseCategory {
  id: string;
  name: string;
  type: 'agentActs' | 'userActs' | 'backendActions' | 'conditions' | 'tasks' | 'macrotasks';
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