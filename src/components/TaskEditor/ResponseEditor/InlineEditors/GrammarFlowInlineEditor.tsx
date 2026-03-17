// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useCallback } from 'react';
import { GrammarEditor } from '@components/GrammarEditor';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';
import EditorHeader from '@responseEditor/InlineEditors/shared/EditorHeader';
import DialogueTaskService from '@services/DialogueTaskService';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

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
}

export default function GrammarFlowInlineEditor({
  contract,
  onContractChange,
  onClose,
  node,
  kind,
  profile,
  testCases,
  setTestCases,
  onProfileUpdate,
}: GrammarFlowInlineEditorProps) {
  // Load grammar from GrammarFlow engine in contract if it exists (from database)
  const [grammar, setGrammar] = useState<Grammar | null>(() => {
    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      if (template) {
        const engines = template?.dataContract?.engines || [];
        const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');
        if (grammarFlowEngine && grammarFlowEngine.grammarFlow) {
          const loadedGrammar = grammarFlowEngine.grammarFlow as Grammar;
          console.log('[GrammarFlowEditor] ✅ Grammar loaded from database on mount', {
            templateId: node.templateId,
            nodesCount: loadedGrammar.nodes?.length || 0,
            edgesCount: loadedGrammar.edges?.length || 0,
            slotsCount: loadedGrammar.slots?.length || 0,
            semanticSetsCount: loadedGrammar.semanticSets?.length || 0,
          });
          return loadedGrammar;
        }
      }
    }
    return null;
  });

  // Load test phrases from DataContract if they exist
  const [testPhrases, setTestPhrases] = useState<string[]>(() => {
    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      return template?.dataContract?.testPhrases || [];
    }
    return [];
  });

  // ✅ CRITICAL: Reload grammar when node.templateId changes (reopening flow)
  useEffect(() => {
    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      const engines = template?.dataContract?.engines || [];
      const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');
      if (grammarFlowEngine && grammarFlowEngine.grammarFlow) {
        const loadedGrammar = grammarFlowEngine.grammarFlow as Grammar;
        setGrammar(loadedGrammar);
        console.log('[GrammarFlowEditor] ✅ Grammar reloaded from contract', {
          templateId: node.templateId,
          nodesCount: loadedGrammar.nodes?.length || 0,
          edgesCount: loadedGrammar.edges?.length || 0,
          slotsCount: loadedGrammar.slots?.length || 0,
          semanticSetsCount: loadedGrammar.semanticSets?.length || 0,
        });
      } else {
        // No grammar found - clear state
        if (grammar !== null) {
          setGrammar(null);
          console.log('[GrammarFlowEditor] ⚠️ No grammar found in contract, cleared state');
        }
      }
    } else {
      // No templateId - clear state
      if (grammar !== null) {
        setGrammar(null);
      }
    }
  }, [node?.templateId, node?.id]); // ✅ CRITICAL: Also depend on node.id to reload when node changes

  // Reload test phrases when node changes
  useEffect(() => {
    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      const phrases = template?.dataContract?.testPhrases || [];
      setTestPhrases(phrases);
    } else {
      setTestPhrases([]);
    }
  }, [node?.templateId, node?.id]);

  /**
   * Handler for saving grammar from Grammar Editor
   * Saves grammar as a GrammarFlow engine in the contract
   * Also saves test phrases in DataContract.testPhrases
   */
  const handleGrammarSave = useCallback((exportedGrammar: Grammar) => {
    setGrammar(exportedGrammar);

    // Save grammar as GrammarFlow engine in contract
    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      if (!template) {
        console.warn('[GrammarFlowEditor] Template not found:', node.templateId);
        return;
      }

      if (!template.dataContract) {
        template.dataContract = {
          templateId: node.templateId,
          templateName: template.label || node.templateId,
          subDataMapping: {},
          engines: [],
          outputCanonical: { format: 'value' }
        };
      }

      const engines = template.dataContract.engines || [];
      const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');

      if (grammarFlowEngine) {
        // Update existing GrammarFlow engine
        grammarFlowEngine.grammarFlow = exportedGrammar;
      } else {
        // Create new GrammarFlow engine
        engines.push({
          type: 'grammarflow',
          enabled: true,
          grammarFlow: exportedGrammar
        });
        template.dataContract.engines = engines;
      }

      // Save test phrases in DataContract.testPhrases
      template.dataContract.testPhrases = testPhrases;

      DialogueTaskService.markTemplateAsModified(node.templateId);

      console.log('[GrammarFlowEditor] ✅ Grammar saved as GrammarFlow engine', {
        nodes: exportedGrammar.nodes.length,
        edges: exportedGrammar.edges.length,
        slots: exportedGrammar.slots.length,
        semanticSets: exportedGrammar.semanticSets.length,
        testPhrases: testPhrases.length,
      });

      // Update contract prop if provided
      if (contract && onContractChange) {
        const updatedContract: DataContract = {
          ...contract,
          engines: template.dataContract.engines,
          testPhrases: template.dataContract.testPhrases,
        };
        onContractChange(updatedContract);
      }
    }
  }, [node?.templateId, testPhrases, contract, onContractChange]);

  /**
   * Handler for test phrases changes
   * Saves test phrases to DataContract
   */
  const handleTestPhrasesChange = useCallback((phrases: string[]) => {
    setTestPhrases(phrases);

    // Save test phrases to DataContract immediately
    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      if (template) {
        if (!template.dataContract) {
          template.dataContract = {
            templateId: node.templateId,
            templateName: template.label || node.templateId,
            subDataMapping: {},
            engines: [],
            outputCanonical: { format: 'value' }
          };
        }
        template.dataContract.testPhrases = phrases;
        DialogueTaskService.markTemplateAsModified(node.templateId);
        console.log('[GrammarFlowEditor] ✅ Test phrases saved:', phrases.length);

        // Update contract prop if provided
        if (contract && onContractChange) {
          const updatedContract: DataContract = {
            ...contract,
            testPhrases: phrases,
          };
          onContractChange(updatedContract);
        }
      }
    }
  }, [node?.templateId, contract, onContractChange]);

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
      <EditorHeader
        title="GrammarFlow (GrammarFlow)"
        extractorType="regex" // Use regex color scheme for now (can be customized later)
        isCreateMode={!grammar}
        isGenerating={false}
        shouldShowButton={false} // GrammarEditor has its own save button
        onButtonClick={() => {}}
        onClose={onClose}
        hideButton={true} // Hide button - GrammarEditor toolbar has save/close
      />

      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <GrammarEditor
          key={`grammarflow-editor-${node?.templateId || 'no-template'}-${grammar?.id || 'no-grammar'}`}
          initialGrammar={grammar || undefined}
          onSave={handleGrammarSave}
          slots={grammar?.slots || []}
          semanticSets={grammar?.semanticSets || []}
          hideToolbar={false} // Show toolbar with save/close buttons
          editorMode="graph"
          initialTestPhrases={testPhrases}
          onTestPhrasesChange={handleTestPhrasesChange}
        />
      </div>
    </div>
  );
}
