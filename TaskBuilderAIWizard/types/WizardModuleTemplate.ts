import { WizardConstraint } from './WizardConstraint';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

export type WizardModuleTemplate = {
  id: string;
  name: string;
  label: string;
  type: string;
  icon: string;
  subTasks?: Array<{ templateId: string; label: string; type: string }>;
  constraints?: WizardConstraint[];
  dataContract?: DataContract;
  examples?: string[];
};
