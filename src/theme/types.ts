// ============================================================================
// TIPI PER IL SISTEMA DI THEMING
// ============================================================================

export interface ThemeProperties {
  background?: string;
  color?: string;
  borderColor?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
}

export interface ThemeElement {
  id: string;
  type: 'header' | 'button' | 'node' | 'canvas' | 'grid' | 'sidebar' | 'text' | 'component';
  name: string;
  properties: ThemeProperties;
  selector: string;
  editableProperties: (keyof ThemeProperties)[];
}

export interface SidebarColors {
  agentActs: string;
  userActs: string;
  backendActions: string;
  conditions: string;
  tasks: string;
  macrotasks: string;
  ddt: string;
} 