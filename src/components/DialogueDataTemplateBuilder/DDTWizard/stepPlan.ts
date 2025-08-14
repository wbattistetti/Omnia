import type { SchemaNode, Constraint } from './MainDataCollection';

export type PlanStepType =
  | 'start'
  | 'noMatch'
  | 'noInput'
  | 'confirmation'
  | 'notConfirmed'
  | 'success'
  | 'constraintMessages'
  | 'validator'
  | 'testset';

export interface StepPlanItem {
  path: string; // e.g., "Full Name" or "Address/Street"
  type: PlanStepType;
  constraintKind?: string;
}

const isCountableConstraint = (c: Constraint): boolean => c?.kind !== 'required';

const seg = (label?: string) => (label || '').split('/').join('-');

export function buildStepPlan(mains: SchemaNode[]): StepPlanItem[] {
  const steps: StepPlanItem[] = [];
  const addBaseMain = (path: string) => {
    steps.push(
      { path, type: 'start' },
      { path, type: 'noMatch' },
      { path, type: 'noInput' },
      { path, type: 'confirmation' },
      { path, type: 'notConfirmed' },
      { path, type: 'success' }
    );
  };

  const addBaseSub = (path: string) => {
    steps.push(
      { path, type: 'start' },
      { path, type: 'noMatch' },
      { path, type: 'noInput' }
    );
  };

  for (const m of mains || []) {
    const mPath = seg(m.label);
    addBaseMain(mPath);
    for (const c of (m.constraints || []).filter(isCountableConstraint)) {
      steps.push(
        { path: mPath, type: 'constraintMessages', constraintKind: c.kind },
        { path: mPath, type: 'validator', constraintKind: c.kind },
        { path: mPath, type: 'testset', constraintKind: c.kind }
      );
    }
    for (const s of m.subData || []) {
      const sPath = `${seg(m.label)}/${seg(s.label)}`;
      addBaseSub(sPath);
      for (const c of (s.constraints || []).filter(isCountableConstraint)) {
        steps.push(
          { path: sPath, type: 'constraintMessages', constraintKind: c.kind },
          { path: sPath, type: 'validator', constraintKind: c.kind },
          { path: sPath, type: 'testset', constraintKind: c.kind }
        );
      }
    }
  }
  return steps;
}


