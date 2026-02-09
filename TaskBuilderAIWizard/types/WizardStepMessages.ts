export type WizardStepMessages = {
  ask: { base: string[]; reask?: string[] };
  confirm?: { base: string[]; reask?: string[] };
  notConfirmed?: { base: string[] };
  violation?: { base: string[]; reask?: string[] };
  disambiguation?: { base: string[]; options: string[] };
  success?: { base: string[]; reward?: string[] };
};
