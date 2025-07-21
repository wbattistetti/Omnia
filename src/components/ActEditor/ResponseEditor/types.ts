// Executive summary: TypeScript interfaces and types for the Response Editor components.
export interface TreeNodeProps {
  text: string;
  type: 'root' | 'nomatch' | 'noinput' | 'action';
  level?: number;
  expanded?: boolean;
  id: string;
  icon?: string;
  color?: string;
  parentId?: string;
  onDrop: (id: string, position: 'before' | 'after' | 'child' | 'parent-sibling', draggedData: any) => void;
} 