import { WizardConstraint } from './WizardConstraint';
import { WizardNLPContract } from './WizardNLPContract';

export type WizardModuleTemplate = {
  id: string;
  name: string;
  label: string;
  type: string;
  icon: string;
  subTasks?: Array<{ templateId: string; label: string; type: string }>;
  constraints?: WizardConstraint[];
  dataContract?: WizardNLPContract;
  examples?: string[];
};
