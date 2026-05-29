import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '@types/taskTypes';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { BackendAnalysisBackendRecord } from '../backendAnalysisDocumentV2';
import {
  catalogEntryAnalysisStaleAfterSpecRefresh,
  resolveCatalogEntryOpenApiContentHash,
} from '../catalogEntryAnalysisStaleAfterSpecRefresh';

const entry: ManualCatalogEntry = {
  id: 'b1',
  label: 'next-window',
  endpointUrl: 'https://example.supabase.co/functions/v1/agenda-solver/next-window',
  method: 'POST',
  creationMode: 'import',
  lastStructuralEditAt: '2020-01-01T00:00:00.000Z',
  frozenMeta: {
    importState: 'ok',
    lastImportedAt: '2026-01-01T00:00:00.000Z',
    contentHash: 'hash-new',
  },
};

const backendWithAnalysis: BackendAnalysisBackendRecord = {
  catalogEntryId: 'b1',
  displayLabel: 'next-window',
  howToUseMarkdown: 'Usa per slot',
  parameters: {
    days: {
      paramKey: 'days',
      direction: 'input',
      kind: 'required',
      role: 'vecchio',
      descriptionShort: '',
      analysisSummary: 'summary',
      analysisDetailMarkdown: '',
    },
  },
  suggestedFeatures: [],
  analysisOpenApiContentHash: 'hash-old',
};

describe('catalogEntryAnalysisStaleAfterSpecRefresh', () => {
  it('resolveCatalogEntryOpenApiContentHash prefers catalog frozenMeta', () => {
    expect(resolveCatalogEntryOpenApiContentHash(entry, null)).toBe('hash-new');
  });

  it('detects stale analysis when OpenAPI content hash changed', () => {
    expect(
      catalogEntryAnalysisStaleAfterSpecRefresh(entry, backendWithAnalysis, null)
    ).toBe(true);
  });

  it('detects stale analysis when hash invalidated by Recupera specifiche', () => {
    const backend = { ...backendWithAnalysis, analysisOpenApiContentHash: null };
    expect(catalogEntryAnalysisStaleAfterSpecRefresh(entry, backend, null)).toBe(true);
  });

  it('detects stale analysis when wire params differ without hash stamp (legacy)', () => {
    const backend = { ...backendWithAnalysis, analysisOpenApiContentHash: undefined };
    const task = {
      type: TaskType.BackendCall,
      id: 'b1',
      inputs: [{ internalName: 'forbiddenMonths', apiParam: 'forbiddenMonths', variable: '' }],
      outputs: [],
    } as Task;
    expect(catalogEntryAnalysisStaleAfterSpecRefresh(entry, backend, task)).toBe(true);
  });

  it('is fresh when hash and params align', () => {
    const backend: BackendAnalysisBackendRecord = {
      ...backendWithAnalysis,
      analysisOpenApiContentHash: 'hash-new',
      parameters: {
        forbiddenMonths: {
          paramKey: 'forbiddenMonths',
          direction: 'input',
          kind: 'required',
          role: 'filtro mesi',
          descriptionShort: '',
          analysisSummary: 'x',
          analysisDetailMarkdown: '',
        },
      },
    };
    const task = {
      type: TaskType.BackendCall,
      id: 'b1',
      inputs: [{ internalName: 'forbiddenMonths', apiParam: 'forbiddenMonths', variable: '' }],
      outputs: [],
    } as Task;
    expect(catalogEntryAnalysisStaleAfterSpecRefresh(entry, backend, task)).toBe(false);
  });
});
