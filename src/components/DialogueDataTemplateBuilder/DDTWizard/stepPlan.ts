import type { SchemaNode, Constraint } from './dataCollection';

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

export const seg = (label?: string) => (label || '').split('/').join('-');

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

// Build a partial plan given a set of changed paths.
// changes: { mains: Set of main labels, subs: Set of "Main/Sub" labels, constraints: Set of paths possibly including "::constraint#idx" suffix }
export function buildPartialPlanForChanges(
  mains: SchemaNode[],
  changes: { mains: Set<string>; subs: Set<string>; constraints: Set<string> }
): StepPlanItem[] {
  const plan: StepPlanItem[] = [];
  const baseMain = (mLabel: string) => {
    const mPath = seg(mLabel);
    plan.push(
      { path: mPath, type: 'start' },
      { path: mPath, type: 'noMatch' },
      { path: mPath, type: 'noInput' },
      { path: mPath, type: 'confirmation' },
      { path: mPath, type: 'notConfirmed' },
      { path: mPath, type: 'success' }
    );
  };
  const baseSub = (mLabel: string, sLabel: string) => {
    const sPath = `${seg(mLabel)}/${seg(sLabel)}`;
    plan.push(
      { path: sPath, type: 'start' },
      { path: sPath, type: 'noMatch' },
      { path: sPath, type: 'noInput' }
    );
  };
  const addConstraintSteps = (mLabel: string, sLabel?: string) => {
    const p = sLabel ? `${seg(mLabel)}/${seg(sLabel)}` : seg(mLabel);
    plan.push(
      { path: p, type: 'constraintMessages' },
      { path: p, type: 'validator' },
      { path: p, type: 'testset' }
    );
  };

  // Mains added/dirty
  for (const mLabel of changes.mains) baseMain(mLabel);

  // Subs added/dirty
  for (const subPath of changes.subs) {
    const [m, s] = String(subPath).split('/');
    if (m && s) baseSub(m, s);
  }

  // Constraints added/dirty
  for (const cPath of changes.constraints) {
    const raw = String(cPath).split('::')[0]; // strip ::constraint#idx if present
    const [m, s] = raw.split('/');
    if (m && s) addConstraintSteps(m, s);
    else if (m) addConstraintSteps(m);
  }

  return plan;
}


