// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { GrammarEditor } from '@components/GrammarEditor';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';
import { useGrammarStore } from '@components/GrammarEditor/core/state/grammarStore';
import EditorHeader from '@responseEditor/InlineEditors/shared/EditorHeader';
import DialogueTaskService from '@services/DialogueTaskService';
import { taskRepository } from '@services/TaskRepository';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { TaskTreeNode } from '@types/taskTypes';
import { hasValidTemplateIdRef, taskRowUsesSubTasksContract } from '@utils/taskKind';
import { catalogueLookupTemplateId } from '@utils/taskTreeNodeCatalogueLookup';
import {
  getGrammarFlowFromContract,
  mergeGrammarFlowIntoContract,
} from './grammarFlowContractHelpers';
import { useGrammarFlowContractSync } from './useGrammarFlowContractSync';

interface GrammarFlowInlineEditorProps {
  contract: DataContract | null;
  onContractChange: (contract: DataContract) => void;
  onClose: () => void;
  node?: any;
  kind?: string;
  profile?: any;
  testCases?: string[];
  setTestCases?: (cases: string[]) => void;
  onProfileUpdate?: (profile: any) => void;
  taskId?: string;
}

export default function GrammarFlowInlineEditor({
  contract,
  onContractChange,
  onClose,
  node,
  taskId,
}: GrammarFlowInlineEditorProps) {
  const taskRow = taskId ? taskRepository.getTask(taskId) : null;
  const useNodeContractOnly = taskRowUsesSubTasksContract(taskRow);

  const catalogueTemplateLookupId = useMemo(
    () => (node ? catalogueLookupTemplateId(node as TaskTreeNode) : ''),
    [node?.templateId, node?.catalogTemplateId]
  );
  const effectiveTemplateLookupId = useMemo(() => {
    if (useNodeContractOnly) return '';
    // Template-backed rows must persist grammarFlow on the owning task template id.
    // Falling back to node lookup would target ephemeral node ids and lose payload on reopen.
    if (hasValidTemplateIdRef(taskRow)) {
      return String(taskRow!.templateId);
    }
    return catalogueTemplateLookupId || '';
  }, [useNodeContractOnly, taskRow?.templateId, catalogueTemplateLookupId]);

  const { grammar, setGrammar, testPhrases, setTestPhrases } = useGrammarFlowContractSync({
    contract,
    useNodeContractOnly,
    nodeId: node?.id,
    nodeTemplateId: effectiveTemplateLookupId || undefined,
  });

  const useNodeContractOnlyRef = useRef(useNodeContractOnly);
  useNodeContractOnlyRef.current = useNodeContractOnly;

  const testPhrasesRef = useRef(testPhrases);
  testPhrasesRef.current = testPhrases;

  const persistStandalone = useCallback(
    (g: Grammar, phrases: string[]) => {
      onContractChange(mergeGrammarFlowIntoContract(contract, g, phrases));
    },
    [contract, onContractChange]
  );

  const persistStandaloneRef = useRef(persistStandalone);
  persistStandaloneRef.current = persistStandalone;

  const handleGrammarSave = useCallback(
    (exportedGrammar: Grammar) => {
      setGrammar(exportedGrammar);

      if (useNodeContractOnly) {
        persistStandalone(exportedGrammar, testPhrases);
        return;
      }

      if (!effectiveTemplateLookupId) {
        return;
      }

      const template = DialogueTaskService.getTemplate(effectiveTemplateLookupId);
      if (!template) {
        return;
      }

      if (!template.dataContract) {
        template.dataContract = {
          templateId: effectiveTemplateLookupId,
          templateName: template.label || effectiveTemplateLookupId,
          subDataMapping: {},
          engines: [],
          outputCanonical: { format: 'value' },
        };
      }

      const engines = template.dataContract.engines || [];
      const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');

      if (grammarFlowEngine) {
        grammarFlowEngine.grammarFlow = exportedGrammar;
      } else {
        engines.push({
          type: 'grammarflow',
          enabled: true,
          grammarFlow: exportedGrammar,
        });
        template.dataContract.engines = engines;
      }

      template.dataContract.testPhrases = testPhrases;

      DialogueTaskService.markTemplateAsModified(effectiveTemplateLookupId);

      if (contract && onContractChange) {
        onContractChange({
          ...contract,
          engines: template.dataContract.engines,
          testPhrases: template.dataContract.testPhrases,
        });
      }
    },
    [
      effectiveTemplateLookupId,
      testPhrases,
      contract,
      onContractChange,
      useNodeContractOnly,
      persistStandalone,
      setGrammar,
    ]
  );

  const handleGrammarSaveRef = useRef(handleGrammarSave);
  handleGrammarSaveRef.current = handleGrammarSave;

  /** True after header close: avoids duplicate persist on unmount (double onContractChange → grid flicker). */
  const closedExplicitlyRef = useRef(false);

  const handleCloseClick = useCallback(() => {
    const { grammar: currentGrammar } = useGrammarStore.getState();
    if (currentGrammar) {
      if (useNodeContractOnlyRef.current) {
        persistStandaloneRef.current(currentGrammar, testPhrasesRef.current);
      } else if (effectiveTemplateLookupId) {
        handleGrammarSaveRef.current(currentGrammar);
      }
    }
    closedExplicitlyRef.current = true;
    onClose();
  }, [effectiveTemplateLookupId, onClose]);

  useEffect(() => {
    if (useNodeContractOnly || !effectiveTemplateLookupId) {
      return;
    }
    const grammarFlowEditors = (window as any).__grammarFlowEditors || new Map();
    grammarFlowEditors.set(effectiveTemplateLookupId, true);
    (window as any).__grammarFlowEditors = grammarFlowEditors;

    return () => {
      const g = (window as any).__grammarFlowEditors;
      if (g) {
        g.delete(effectiveTemplateLookupId);
      }
    };
  }, [useNodeContractOnly, effectiveTemplateLookupId]);

  // Save grammar on unmount when navigation closes the editor without header close (e.g. route change).
  // Skip when handleCloseClick already persisted — otherwise the same save runs twice and the TesterGrid flickers.
  useEffect(() => {
    return () => {
      if (closedExplicitlyRef.current) {
        return;
      }
      const { grammar: currentGrammar } = useGrammarStore.getState();
      if (!currentGrammar) {
        return;
      }
      if (useNodeContractOnlyRef.current) {
        persistStandaloneRef.current(currentGrammar, testPhrasesRef.current);
        return;
      }
      if (effectiveTemplateLookupId) {
        handleGrammarSaveRef.current(currentGrammar);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs carry latest callbacks; deps only catalogueTemplateLookupId
  }, [effectiveTemplateLookupId]);

  const handleTestPhrasesChange = useCallback(
    (phrases: string[]) => {
      setTestPhrases(phrases);

      if (useNodeContractOnly) {
        const g = grammar ?? getGrammarFlowFromContract(contract);
        if (g) {
          persistStandalone(g, phrases);
        } else {
          const base: DataContract =
            contract && typeof contract === 'object'
              ? { ...contract }
              : {
                  subDataMapping: {},
                  engines: [],
                  outputCanonical: { format: 'value' },
                };
          base.testPhrases = phrases.length ? phrases : undefined;
          onContractChange(base);
        }
        return;
      }

      if (!effectiveTemplateLookupId) {
        return;
      }

      const template = DialogueTaskService.getTemplate(effectiveTemplateLookupId);
      if (!template) {
        return;
      }

      if (!template.dataContract) {
        template.dataContract = {
          templateId: effectiveTemplateLookupId,
          templateName: template.label || effectiveTemplateLookupId,
          subDataMapping: {},
          engines: [],
          outputCanonical: { format: 'value' },
        };
      }
      template.dataContract.testPhrases = phrases;
      DialogueTaskService.markTemplateAsModified(effectiveTemplateLookupId);

      if (contract && onContractChange) {
        onContractChange({
          ...contract,
          testPhrases: phrases,
        });
      }
    },
    [
      useNodeContractOnly,
      grammar,
      contract,
      persistStandalone,
      onContractChange,
      effectiveTemplateLookupId,
      setTestPhrases,
    ]
  );

  const grammarKey = useNodeContractOnly
    ? `grammarflow-editor-node-${node?.id || 'no-node'}`
    : `grammarflow-editor-${effectiveTemplateLookupId || 'no-template'}-${grammar?.id || 'no-grammar'}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#121621',
        color: '#c9d1d9',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 200,
          flexShrink: 0,
        }}
      >
        <EditorHeader
          title="GrammarFlow (GrammarFlow)"
          extractorType="regex"
          isCreateMode={!grammar}
          isGenerating={false}
          shouldShowButton={false}
          onButtonClick={() => {}}
          onClose={handleCloseClick}
          hideButton={true}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <GrammarEditor
          key={grammarKey}
          initialGrammar={grammar || undefined}
          onSave={handleGrammarSave}
          slots={grammar?.slots || []}
          semanticSets={grammar?.semanticSets || []}
          hideToolbar={false}
          editorMode="graph"
          initialTestPhrases={testPhrases}
          onTestPhrasesChange={handleTestPhrasesChange}
        />
      </div>
    </div>
  );
}
