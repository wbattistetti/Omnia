export interface IntellisenseItem {
  id: string;
  label: string; // testo principale da mostrare
  shortLabel?: string; // opzionale, versione sintetica
  name: string;
  description: string;
  category: string;
  categoryType: 'taskTemplates' | 'userActs' | 'backendActions' | 'conditions' | 'macrotasks';
  // Underlying entity identifiers
  actId?: string; // original item.id
  factoryId?: string; // optional backend _id
  icon?: React.ReactNode;
  iconComponent?: React.ComponentType<any>;
  color?: string;
  // Interaction mode for agent acts (used for icons/colors)
  mode?: 'DataRequest' | 'DataConfirmation' | 'Message';
  // New: explicit act type propagated to rows
  type?: 'AIAgent' | 'Message' | 'DataRequest' | 'ProblemClassification' | 'Summarizer' | 'BackendCall' | 'Negotiation';
  userActs?: string[];
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