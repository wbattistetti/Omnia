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
  parameters?: any[];
  included?: boolean; // Per recovery/escalation: se incluso nel dialogo
  onDrop?: (id: string, position: 'before' | 'after' | 'child' | 'parent-sibling', draggedData: any) => void;
} 