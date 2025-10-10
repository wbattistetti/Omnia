export type DockTab = { id: string; title: string; flowId: string };

export type SplitNode = {
  kind: 'split';
  id: string;
  orientation: 'row' | 'col';
  children: DockNode[];
};

export type TabSetNode = {
  kind: 'tabset';
  id: string;
  tabs: DockTab[];
  active: number; // index in tabs
};

export type DockNode = SplitNode | TabSetNode;

export type DockRegion = 'left' | 'right' | 'top' | 'bottom' | 'center';


