// Executive summary: TypeScript interfaces and types for the Response Editor components.
export interface TreeNodeParameter {
  key: string;
  value: string;
}

export interface TreeNodeProps {
  text: string;
  type: 'root' | 'nomatch' | 'noinput' | 'action' | 'success' | string;
  level?: number;
  expanded?: boolean;
  id: string;
  icon?: string;
  color?: string;
  parentId?: string;
  label?: string;
  primaryValue?: string;
  parameters?: TreeNodeParameter[];
  onDrop?: (id: string, position: 'before' | 'after' | 'child' | 'parent-sibling', draggedData: any) => void;
} 