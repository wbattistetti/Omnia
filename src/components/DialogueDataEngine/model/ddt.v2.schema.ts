// Lightweight runtime validator for DDTTemplateV2 (no external deps)
import type { DDTTemplateV2 } from './ddt.v2.types';

export type ValidationIssue = { path: string; message: string };

export function validateDDTTemplateV2(doc: any): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });

  if (!doc || typeof doc !== 'object') {
    fail('$', 'Document must be an object');
    return { valid: false, issues };
  }

  if (doc.schemaVersion !== '2') fail('schemaVersion', 'schemaVersion must be "2"');

  if (!doc.metadata || typeof doc.metadata !== 'object') fail('metadata', 'metadata is required');
  else {
    if (!doc.metadata.id) fail('metadata.id', 'metadata.id is required');
    if (!doc.metadata.label) fail('metadata.label', 'metadata.label is required');
  }

  if (!Array.isArray(doc.nodes)) fail('nodes', 'nodes must be an array');
  else {
    doc.nodes.forEach((n: any, idx: number) => {
      const p = `nodes[${idx}]`;
      if (!n?.id) fail(`${p}.id`, 'id is required');
      if (!n?.label) fail(`${p}.label`, 'label is required');
      if (!n?.kind) fail(`${p}.kind`, 'kind is required');
      if (!n?.type) fail(`${p}.type`, 'type is required');
      if (!n?.steps) fail(`${p}.steps`, 'steps is required');
      else {
        const s = n.steps;
        if (!s.ask?.base) fail(`${p}.steps.ask.base`, 'ask.base is required');
        if (!Array.isArray(s.ask?.reaskNoInput) || s.ask.reaskNoInput.length !== 3) fail(`${p}.steps.ask.reaskNoInput`, 'must be array length 3');
        if (!Array.isArray(s.ask?.reaskNoMatch) || s.ask.reaskNoMatch.length !== 3) fail(`${p}.steps.ask.reaskNoMatch`, 'must be array length 3');
        if (s.confirm) {
          if (!Array.isArray(s.confirm.noInput) || s.confirm.noInput.length !== 3) fail(`${p}.steps.confirm.noInput`, 'must be array length 3');
          if (!Array.isArray(s.confirm.noMatch) || s.confirm.noMatch.length !== 3) fail(`${p}.steps.confirm.noMatch`, 'must be array length 3');
        }
        if (s.notConfirmed) {
          if (!Array.isArray(s.notConfirmed.prompts) || s.notConfirmed.prompts.length !== 3) fail(`${p}.steps.notConfirmed.prompts`, 'must be array length 3');
        }
        if (s.violation) {
          if (!Array.isArray(s.violation.prompts) || s.violation.prompts.length !== 3) fail(`${p}.steps.violation.prompts`, 'must be array length 3');
        }
        if (s.success) {
          if (!Array.isArray(s.success.base) || s.success.base.length < 1) fail(`${p}.steps.success.base`, 'must be non-empty array');
        }
      }
    });
  }

  return { valid: issues.length === 0, issues };
}


