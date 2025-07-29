// Executive summary: TypeScript interfaces and types for the Response Editor components.
export interface TreeNodeParameter {
  key: string;
  value: string;
}

export interface TreeNodeProps {
  id: string;
  text: string;
  type: string;
  level?: number;
  parentId?: string;
  icon?: string;
  color?: string;
  label?: string;
  primaryValue?: string;
  parameters?: TreeNodeParameter[];
  included?: boolean; // Per recovery/escalation: se incluso nel dialogo
  onDrop?: (id: string, position: 'before' | 'after' | 'child' | 'parent-sibling', draggedData: TreeNodeProps) => void;
  onCancelNewNode?: (id: string) => void;
  onToggleInclude?: (id: string, included: boolean) => void;
  stepType?: string;
}

export interface Action {
  id: string;
  type: string;
  label?: string;
  text: string;
  [key: string]: any;
}

export interface Constraint {
  id: string;
  title: string;
  explanation: string;
  [key: string]: any;
}

export interface Parameter {
  id: string;
  name: string;
  value?: any;
  [key: string]: any;
}

export interface TranslationsContextType {
  translationsByDDT: { [ddtKey: string]: any };
  setTranslationsForDDT: (ddtKey: string, translations: any) => void;
  getTranslationsForDDT: (ddtKey: string) => any;
} 