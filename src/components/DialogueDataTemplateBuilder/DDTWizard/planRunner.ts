import type { SchemaNode, Constraint } from './MainDataCollection';
import { buildStepPlan } from './stepPlan';

const API_BASE = (import.meta as any)?.env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

function isCountableConstraint(c?: Constraint) {
  return !!c && c.kind !== 'required';
}

function findDatumByPath(mains: SchemaNode[], path: string): SchemaNode | null {
  const parts = path.split('/');
  const norm = (s?: string) => (s || '').split('/').join('-');
  const main = mains.find(m => norm(m.label) === parts[0]);
  if (!main) return null;
  if (parts.length === 1) return main;
  const sub = (main.subData || []).find(s => norm(s.label) === parts[1]);
  return sub || null;
}

export async function runPlanDry(mains: SchemaNode[]) {
  const plan = buildStepPlan(mains);
  console.log('[planRunner] Running dry plan with', plan.length, 'steps');
  for (const step of plan) {
    try {
      const datum = findDatumByPath(mains, step.path);
      if (!datum) { console.warn('[planRunner] datum not found for path', step.path); continue; }
      if (step.type === 'constraintMessages') {
        const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter(isCountableConstraint) };
        const res = await fetch(`${API_BASE}/api/constraintMessages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        console.log('[planRunner] constraintMessages', step.path, await res.json());
      } else if (step.type === 'validator') {
        const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter(isCountableConstraint) };
        const res = await fetch(`${API_BASE}/api/validator`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        console.log('[planRunner] validator', step.path, await res.json());
      } else if (step.type === 'testset') {
        const datumBody = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter(isCountableConstraint) };
        const res = await fetch(`${API_BASE}/api/testset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: datumBody, notes: [] }) });
        console.log('[planRunner] testset', step.path, await res.json());
      } else {
        // Base prompts use meaning/desc
        const parts = step.path.split('/');
        const meaning = parts[parts.length - 1];
        let endpoint = '';
        switch (step.type) {
          case 'start': endpoint = '/api/startPrompt'; break;
          case 'noMatch': endpoint = '/api/stepNoMatch'; break;
          case 'noInput': endpoint = '/api/stepNoInput'; break;
          case 'confirmation': endpoint = '/api/stepConfirmation'; break;
          case 'success': endpoint = '/api/stepSuccess'; break;
        }
        if (!endpoint) continue;
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meaning, desc: '' }) });
        console.log('[planRunner] base', step.type, step.path, await res.json());
      }
    } catch (e) {
      console.error('[planRunner] step failed', step, e);
      break;
    }
  }
}

export interface PlanRunResult {
  step: { path: string; type: string; constraintKind?: string };
  payload: any;
}

export async function runPlanCollect(mains: SchemaNode[]): Promise<PlanRunResult[]> {
  const results: PlanRunResult[] = [];
  const plan = buildStepPlan(mains);
  for (const step of plan) {
    try {
      const datum = findDatumByPath(mains, step.path);
      if (!datum) { continue; }
      if (step.type === 'constraintMessages') {
        const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter(isCountableConstraint) };
        const res = await fetch(`${API_BASE}/api/constraintMessages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
      } else if (step.type === 'validator') {
        const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter(isCountableConstraint) };
        const res = await fetch(`${API_BASE}/api/validator`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
      } else if (step.type === 'testset') {
        const datumBody = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter(isCountableConstraint) };
        const res = await fetch(`${API_BASE}/api/testset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: datumBody, notes: [] }) });
        results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
      } else {
        const parts = step.path.split('/');
        const meaning = parts[parts.length - 1];
        let endpoint = '';
        switch (step.type) {
          case 'start': endpoint = '/api/startPrompt'; break;
          case 'noMatch': endpoint = '/api/stepNoMatch'; break;
          case 'noInput': endpoint = '/api/stepNoInput'; break;
          case 'confirmation': endpoint = '/api/stepConfirmation'; break;
          case 'success': endpoint = '/api/stepSuccess'; break;
        }
        if (!endpoint) continue;
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meaning, desc: '' }) });
        results.push({ step: { path: step.path, type: step.type }, payload: await res.json() });
      }
    } catch (e) {
      results.push({ step: { path: step.path, type: step.type }, payload: { error: String(e) } });
      break;
    }
  }
  return results;
}


