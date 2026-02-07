import { FakeConstraint } from './FakeConstraint';
import { FakeNLPContract } from './FakeNLPContract';

export type FakeModuleTemplate = {
  id: string;
  name: string;
  label: string;
  type: string;
  icon: string;
  subTasks?: Array<{ templateId: string; label: string; type: string }>;
  constraints?: FakeConstraint[];
  dataContract?: FakeNLPContract;
  examples?: string[];
};
