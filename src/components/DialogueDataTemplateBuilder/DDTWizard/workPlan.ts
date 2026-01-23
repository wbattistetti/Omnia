import type { SchemaNode, Constraint } from './dataCollection';

export interface DatumRef {
  path: string; // e.g., "Full Name" or "Address/Street"
  constraints: Constraint[];
}

export interface WorkPlanSummary {
  numData: number;
  numConstraints: number;
  basePerDatum: number;
  stepsPerConstraint: number; // 3 when validator and tests are separate
  total: number;
  items: DatumRef[];
}

const isCountableConstraint = (c: Constraint): boolean => {
  // We never count required
  return !!c && (c as any).kind !== 'required';
};

export function computeWorkPlan(
  mains: SchemaNode[],
  opts?: { basePerDatum?: number; stepsPerConstraint?: number }
): WorkPlanSummary {
  const basePerDatum = opts?.basePerDatum ?? 5;
  const stepsPerConstraint = opts?.stepsPerConstraint ?? 3;

  const items: DatumRef[] = [];
  let numData = 0;
  let numConstraints = 0;

  for (const m of mains || []) {
    numData += 1;
    const mConstraints = (m.constraints || []).filter(isCountableConstraint);
    numConstraints += mConstraints.length;
    items.push({ path: m.label, constraints: mConstraints });

    if (Array.isArray(m.subData)) {
      for (const s of m.subData) {
        numData += 1;
        const sConstraints = (s.constraints || []).filter(isCountableConstraint);
        numConstraints += sConstraints.length;
        items.push({ path: `${m.label}/${s.label}`, constraints: sConstraints });
      }
    }
  }

  const total = basePerDatum * numData + stepsPerConstraint * numConstraints;
  return { numData, numConstraints, basePerDatum, stepsPerConstraint, total, items };
}


