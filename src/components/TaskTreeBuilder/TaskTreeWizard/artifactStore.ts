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

// Merge a delta store into a base store, without losing existing unrelated artifacts
export function mergeArtifactStores(base: ArtifactStore | null, delta: ArtifactStore): ArtifactStore {
  const out: ArtifactStore = base ? { byPath: { ...base.byPath } } : { byPath: {} };
  for (const [path, bucket] of Object.entries(delta.byPath || {})) {
    if (!out.byPath[path]) out.byPath[path] = { constraints: {} } as PathArtifacts;
    const dest = out.byPath[path];
    // base step payloads (only override if provided in delta)
    for (const key of ['start', 'noMatch', 'noInput', 'confirmation', 'success'] as const) {
      if (bucket[key] !== undefined) (dest as any)[key] = (bucket as any)[key];
    }
    // constraints merge per kind and per section
    const kinds = Object.keys(bucket.constraints || {});
    for (const kind of kinds) {
      const srcC = bucket.constraints[kind] || {};
      dest.constraints[kind] = dest.constraints[kind] || {};
      if (srcC.messages !== undefined) dest.constraints[kind].messages = srcC.messages;
      if (srcC.validator !== undefined) dest.constraints[kind].validator = srcC.validator;
      if (srcC.testset !== undefined) dest.constraints[kind].testset = srcC.testset;
    }
  }
  return out;
}

// Move artifacts from one normalized path to another (used for rename)
export function moveArtifactsPath(store: ArtifactStore, fromPath: string, toPath: string): ArtifactStore {
  if (!fromPath || !toPath || fromPath === toPath) return store;
  const byPath = { ...store.byPath } as Record<string, PathArtifacts>;
  const from = byPath[fromPath];
  if (!from) return store;
  if (!byPath[toPath]) {
    byPath[toPath] = from;
  } else {
    // merge into existing toPath bucket
    const merged = mergeArtifactStores({ byPath: { [toPath]: byPath[toPath] } }, { byPath: { [toPath]: from } });
    byPath[toPath] = merged.byPath[toPath];
  }
  delete byPath[fromPath];
  return { byPath };
}


