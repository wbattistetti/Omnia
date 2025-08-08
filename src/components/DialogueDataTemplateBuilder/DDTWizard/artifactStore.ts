import { v4 as uuidv4 } from 'uuid';
import type { PlanRunResult } from './planRunner';

export type ConstraintBucket = {
  messages?: any;
  validator?: any;
  testset?: any;
};

export type PathArtifacts = {
  start?: any;
  noMatch?: any;
  noInput?: any;
  confirmation?: any;
  success?: any;
  constraints: Record<string, ConstraintBucket>; // by constraintKind
};

export type ArtifactStore = {
  byPath: Record<string, PathArtifacts>;
};

const ensurePath = (byPath: Record<string, PathArtifacts>, path: string): PathArtifacts => {
  if (!byPath[path]) {
    byPath[path] = { constraints: {} };
  }
  return byPath[path];
};

export function buildArtifactStore(results: PlanRunResult[]): ArtifactStore {
  const byPath: Record<string, PathArtifacts> = {};
  for (const r of results || []) {
    const { step, payload } = r;
    const bucket = ensurePath(byPath, step.path);
    switch (step.type) {
      case 'start':
      case 'noMatch':
      case 'noInput':
      case 'confirmation':
      case 'success':
        bucket[step.type] = payload;
        break;
      case 'constraintMessages': {
        const kind = step.constraintKind || 'unknown';
        bucket.constraints[kind] = bucket.constraints[kind] || {};
        bucket.constraints[kind].messages = payload;
        break;
      }
      case 'validator': {
        const kind = step.constraintKind || 'unknown';
        bucket.constraints[kind] = bucket.constraints[kind] || {};
        bucket.constraints[kind].validator = payload;
        break;
      }
      case 'testset': {
        const kind = step.constraintKind || 'unknown';
        bucket.constraints[kind] = bucket.constraints[kind] || {};
        bucket.constraints[kind].testset = payload;
        break;
      }
      default:
        break;
    }
  }
  return { byPath };
}

// Helpers
export function normalizePathSegment(segment: string): string {
  return (segment || '').replace(/\//g, '-');
}

export function makeDDTIdFromLabel(label: string): string {
  const safe = (label || 'DDT').trim().replace(/\s+/g, '_');
  return `${safe}_${uuidv4()}`;
}


