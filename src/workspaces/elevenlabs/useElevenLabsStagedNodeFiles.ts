/**
 * KB/tool file staging per ConvAI node with workspace session persistence.
 */

import React from 'react';
import {
  filesToStaged,
  stagedNodeFilesKey,
  type PersistedKbDocument,
  type StagedKbDocument,
  type StagedNodeFile,
  type StagedNodeFileKind,
} from './elevenLabsStagedNodeFiles';
import { getKbWorkspacePersist, setKbWorkspacePersist } from './kbWorkspacePersist';
import { isKbTxtFile, isKbXlsxFile, parseKbFile } from './parseKbDocument';

function emptyKbDoc(base: StagedNodeFile, parseStatus: StagedKbDocument['parseStatus']): StagedKbDocument {
  return {
    ...base,
    parseStatus,
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
  };
}

function persistedToStaged(p: PersistedKbDocument): StagedKbDocument {
  return {
    ...p,
    file: new File([], p.name, { type: p.mimeType }),
  };
}

function stagedToPersisted(d: StagedKbDocument): PersistedKbDocument {
  const { file: _file, ...rest } = d;
  return rest;
}

export function useElevenLabsKbWorkspace(projectId: string | undefined, agentId: string): {
  getStaged: (nodeId: string, kind: StagedNodeFileKind) => StagedNodeFile[];
  getStagedKb: (nodeId: string) => StagedKbDocument[];
  addKbFiles: (nodeId: string, files: readonly File[]) => void;
  removeStaged: (nodeId: string, kind: StagedNodeFileKind, fileId: string) => void;
  updateKbDoc: (nodeId: string, docId: string, patch: Partial<Pick<StagedKbDocument, 'howToUseText' | 'markdownSnippet'>>) => void;
  agentSystemPromptMarkdown: string;
  setAgentSystemPromptMarkdown: (markdown: string) => void;
  collectAllKbSnippets: (nodeLabelsById: Record<string, string>) => import('./api/kbPromptApi').KbLocalSnippetInput[];
} {
  const [byKey, setByKey] = React.useState<Record<string, StagedNodeFile[]>>({});
  const [kbByKey, setKbByKey] = React.useState<Record<string, StagedKbDocument[]>>({});
  const [agentSystemPromptMarkdown, setAgentSystemPromptMarkdownState] = React.useState('');

  const hydrateFromPersist = React.useCallback(
    (aid: string) => {
      if (!aid.trim()) return;
      const persisted = getKbWorkspacePersist(projectId, aid);
      setAgentSystemPromptMarkdownState(persisted.agentSystemPromptMarkdown);
      const nextKb: Record<string, StagedKbDocument[]> = {};
      for (const [nodeId, docs] of Object.entries(persisted.byNodeId)) {
        nextKb[stagedNodeFilesKey(aid, nodeId, 'kb')] = docs.map(persistedToStaged);
      }
      setKbByKey(nextKb);
    },
    [projectId]
  );

  React.useEffect(() => {
    hydrateFromPersist(agentId);
  }, [agentId, hydrateFromPersist]);

  React.useEffect(() => {
    if (!agentId.trim()) return;
    const byNodeId: Record<string, PersistedKbDocument[]> = {};
    for (const [key, docs] of Object.entries(kbByKey)) {
      const parts = key.split('\x1e');
      const nodeId = parts[1];
      if (!nodeId) continue;
      byNodeId[nodeId] = docs.map(stagedToPersisted);
    }
    setKbWorkspacePersist(projectId, agentId, {
      byNodeId,
      agentSystemPromptMarkdown,
    });
  }, [agentId, kbByKey, agentSystemPromptMarkdown, projectId]);

  const setAgentSystemPromptMarkdown = React.useCallback((markdown: string) => {
    setAgentSystemPromptMarkdownState(markdown);
  }, []);

  const getStaged = React.useCallback(
    (nodeId: string, kind: StagedNodeFileKind) =>
      kind === 'kb'
        ? kbByKey[stagedNodeFilesKey(agentId, nodeId, 'kb')] ?? []
        : byKey[stagedNodeFilesKey(agentId, nodeId, kind)] ?? [],
    [byKey, kbByKey, agentId]
  );

  const getStagedKb = React.useCallback(
    (nodeId: string) => kbByKey[stagedNodeFilesKey(agentId, nodeId, 'kb')] ?? [],
    [kbByKey, agentId]
  );

  const addStaged = React.useCallback(
    (nodeId: string, kind: StagedNodeFileKind, files: readonly File[]) => {
      if (!agentId.trim() || !nodeId.trim() || files.length === 0) return;
      const key = stagedNodeFilesKey(agentId, nodeId, kind);
      const next = filesToStaged(files);
      setByKey((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), ...next],
      }));
    },
    [agentId]
  );

  const parseKbEntry = React.useCallback(
    async (nodeId: string, docId: string, file: File) => {
      const key = stagedNodeFilesKey(agentId, nodeId, 'kb');
      try {
        const result = await parseKbFile(file);
        setKbByKey((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).map((d) =>
            d.id === docId
              ? {
                  ...d,
                  parseStatus: 'ready' as const,
                  format: result.format,
                  variables: result.variables,
                  variableDictionary: result.variableDictionary,
                  parseError: undefined,
                }
              : d
          ),
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setKbByKey((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).map((d) =>
            d.id === docId
              ? {
                  ...d,
                  parseStatus: 'error' as const,
                  parseError: message,
                  variables: [],
                  variableDictionary: {},
                }
              : d
          ),
        }));
      }
    },
    [agentId]
  );

  const addKbFiles = React.useCallback(
    (nodeId: string, files: readonly File[]) => {
      if (!agentId.trim() || !nodeId.trim() || files.length === 0) return;
      const key = stagedNodeFilesKey(agentId, nodeId, 'kb');
      const bases = filesToStaged(files);
      const pending: StagedKbDocument[] = bases.map((base) => {
        const parsable = isKbTxtFile(base.file) || isKbXlsxFile(base.file);
        return emptyKbDoc(base, parsable ? 'parsing' : 'unsupported');
      });
      setKbByKey((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), ...pending],
      }));
      for (const doc of pending) {
        if (doc.parseStatus === 'parsing') {
          void parseKbEntry(nodeId, doc.id, doc.file);
        }
      }
    },
    [agentId, parseKbEntry]
  );

  const updateKbDoc = React.useCallback(
    (nodeId: string, docId: string, patch: Partial<Pick<StagedKbDocument, 'howToUseText' | 'markdownSnippet'>>) => {
      const key = stagedNodeFilesKey(agentId, nodeId, 'kb');
      setKbByKey((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).map((d) => (d.id === docId ? { ...d, ...patch } : d)),
      }));
    },
    [agentId]
  );

  const removeStaged = React.useCallback(
    (nodeId: string, kind: StagedNodeFileKind, fileId: string) => {
      const key = stagedNodeFilesKey(agentId, nodeId, kind);
      if (kind === 'kb') {
        setKbByKey((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).filter((f) => f.id !== fileId),
        }));
        return;
      }
      setByKey((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).filter((f) => f.id !== fileId),
      }));
    },
    [agentId]
  );

  const collectAllKbSnippets = React.useCallback(
    (nodeLabelsById: Record<string, string>) => {
      const out: import('./api/kbPromptApi').KbLocalSnippetInput[] = [];
      for (const [key, docs] of Object.entries(kbByKey)) {
        if (!key.startsWith(`${agentId}\x1e`) || !key.endsWith('\x1ekb')) continue;
        const nodeId = key.split('\x1e')[1] ?? '';
        for (const doc of docs) {
          if (!doc.markdownSnippet.trim()) continue;
          out.push({
            documentName: doc.name,
            nodeLabel: nodeLabelsById[nodeId] ?? nodeId,
            markdownSnippet: doc.markdownSnippet,
            variables: doc.variables,
          });
        }
      }
      return out;
    },
    [kbByKey, agentId]
  );

  return {
    getStaged,
    getStagedKb,
    addStaged,
    addKbFiles,
    removeStaged,
    updateKbDoc,
    agentSystemPromptMarkdown,
    setAgentSystemPromptMarkdown,
    collectAllKbSnippets,
  };
}

/** @deprecated Use useElevenLabsKbWorkspace — kept for tool files staging. */
export function useElevenLabsStagedNodeFiles() {
  const [byKey, setByKey] = React.useState<Record<string, StagedNodeFile[]>>({});
  const [kbByKey, setKbByKey] = React.useState<Record<string, StagedKbDocument[]>>({});

  const getStaged = React.useCallback(
    (agentId: string, nodeId: string, kind: StagedNodeFileKind) =>
      kind === 'kb'
        ? kbByKey[stagedNodeFilesKey(agentId, nodeId, 'kb')] ?? []
        : byKey[stagedNodeFilesKey(agentId, nodeId, kind)] ?? [],
    [byKey, kbByKey]
  );

  const getStagedKb = React.useCallback(
    (agentId: string, nodeId: string) => kbByKey[stagedNodeFilesKey(agentId, nodeId, 'kb')] ?? [],
    [kbByKey]
  );

  const addStaged = React.useCallback(
    (agentId: string, nodeId: string, kind: StagedNodeFileKind, files: readonly File[]) => {
      if (!agentId.trim() || !nodeId.trim() || files.length === 0) return;
      const key = stagedNodeFilesKey(agentId, nodeId, kind);
      const next = filesToStaged(files);
      setByKey((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...next] }));
    },
    []
  );

  const addKbFiles = React.useCallback(
    (agentId: string, nodeId: string, files: readonly File[]) => {
      if (!agentId.trim() || !nodeId.trim() || files.length === 0) return;
      const key = stagedNodeFilesKey(agentId, nodeId, 'kb');
      const bases = filesToStaged(files);
      const pending = bases.map((base) => emptyKbDoc(base, 'parsing'));
      setKbByKey((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...pending] }));
    },
    []
  );

  const removeStaged = React.useCallback(
    (agentId: string, nodeId: string, kind: StagedNodeFileKind, fileId: string) => {
      const key = stagedNodeFilesKey(agentId, nodeId, kind);
      if (kind === 'kb') {
        setKbByKey((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((f) => f.id !== fileId) }));
        return;
      }
      setByKey((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((f) => f.id !== fileId) }));
    },
    []
  );

  return { getStaged, getStagedKb, addStaged, addKbFiles, removeStaged };
}
