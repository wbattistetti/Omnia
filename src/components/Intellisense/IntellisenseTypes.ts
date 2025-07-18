export interface IntellisenseItem {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryType: 'agentActs' | 'userActs' | 'backendActions' | 'conditions' | 'tasks' | 'macrotasks';
  icon?: React.ReactNode;
  color?: string;
  userActs?: string[];
  uiColor?: string;
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