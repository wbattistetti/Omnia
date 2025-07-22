export type ActionParameter = {
  key: string;
  value: string;
};

export type ActionNode = {
  id: string;
  actionType: string;
  icon: string;
  label?: string;
  primaryParameter: string;
  parameters: ActionParameter[];
  children?: ActionNode[];
  parentId?: string;
}; 