export type EditorKind = 'message' | 'ddt' | 'intent' | 'backend';

export type ActMeta = {
  id: string;
  type: string;
  label?: string;
  instanceId?: string;
};

export type EditorProps = {
  act: ActMeta;
  onClose?: () => void;
};


