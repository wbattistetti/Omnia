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

export const ICON_KEYS = [
  'MessageCircle', 'HelpCircle', 'Headphones', 'Shield', 'PhoneOff', 'Database', 'Mail', 'MessageSquare',
  'Function', 'Music', 'Eraser', 'ArrowRight', 'Tag', 'Clock', 'ServerCog', 'User', 'MapPin', 'Calendar',
  'Type', 'Phone', 'Hash', 'Globe', 'Home', 'Building', 'FileText'
] as const;

export type IconKey = typeof ICON_KEYS[number] | string;

export interface ActionBase {
  actionId: string;
  text?: string;
  textKey?: string;
  icon?: IconKey;
  color?: string;
  label?: string;
}

export interface SayMessageAction extends ActionBase {
  actionId: 'sayMessage';
}

export interface AskQuestionAction extends ActionBase {
  actionId: 'askQuestion';
}

export interface CustomAction extends ActionBase {
  actionId: string; // any other id
}

export type Action = SayMessageAction | AskQuestionAction | CustomAction;

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

export interface Escalation {
  actions: Action[];
}

export interface TranslationsContextType {
  translationsByDDT: { [ddtKey: string]: any };
  setTranslationsForDDT: (ddtKey: string, translations: any) => void;
  getTranslationsForDDT: (ddtKey: string) => any;
} 