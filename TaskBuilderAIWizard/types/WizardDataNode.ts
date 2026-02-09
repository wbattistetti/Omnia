export type WizardDataNode = {
  id: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "object";
  children?: WizardDataNode[];
};
