export type WizardStepMessages = {
  ask: { base: string[]; reask?: string[] };
  noInput?: { base: string[] };
  confirm?: { base: string[]; reask?: string[] };
  notConfirmed?: { base: string[] };
  invalid?: { base: string[]; reask?: string[] };
  success?: { base: string[]; reward?: string[] };
};
