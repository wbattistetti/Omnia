import React from 'react';

// Base properties for all tabs
type DockTabBase = {
  id: string;
  title: string;
};

// Flow tab - for flowchart canvas
export type DockTabFlow = DockTabBase & {
  type: 'flow';
  flowId: string;
};

// Toolbar button type
export type ToolbarButton = {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  title?: string;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
};

// Response Editor tab - for DDT editing
export type DockTabResponseEditor = DockTabBase & {
  type: 'responseEditor';
  ddt: any;
  act?: { id: string; type: string; label?: string; instanceId?: string };
  headerColor?: string; // Color of the ResponseEditor header (e.g., '#9a4f00' for orange)
  toolbarButtons?: ToolbarButton[]; // Toolbar buttons from ResponseEditor
};

// Non-Interactive Editor tab - for simple message editing
export type DockTabNonInteractive = DockTabBase & {
  type: 'nonInteractive';
  instanceId: string;
  value: { template: string; vars?: string[]; samples?: Record<string, string> };
  accentColor?: string;
};

// Condition Editor tab - for condition script editing
export type DockTabConditionEditor = DockTabBase & {
  type: 'conditionEditor';
  variables: Record<string, any>;
  script: string;
  variablesTree?: any[];
  label?: string;
};

// Union type for all tab types
export type DockTab = DockTabFlow | DockTabResponseEditor | DockTabNonInteractive | DockTabConditionEditor;

export type SplitNode = {
  kind: 'split';
  id: string;
  orientation: 'row' | 'col';
  children: DockNode[];
  sizes?: number[]; // Proportions for children (e.g., [0.67, 0.33] for 2/3 and 1/3)
};

export type TabSetNode = {
  kind: 'tabset';
  id: string;
  tabs: DockTab[];
  active: number; // index in tabs
};

export type DockNode = SplitNode | TabSetNode;

export type DockRegion = 'left' | 'right' | 'top' | 'bottom' | 'center';


