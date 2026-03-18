// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GrammarEditor } from '@components/GrammarEditor';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';
import { useGrammarStore } from '@components/GrammarEditor/core/state/grammarStore';
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
        const grammarData = grammarFlowEngine?.grammarFlow;
        if (grammarFlowEngine && grammarData) {
          const loadedGrammar = grammarData as Grammar;
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
    console.log('[GrammarFlowEditor] 🔄 LOAD CHECK', {
      templateId: node?.templateId,
      nodeId: node?.id,
      currentGrammarState: grammar ? 'has-grammar' : 'no-grammar',
    });

    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      console.log('[GrammarFlowEditor] 📋 Template found for load', {
        templateId: node.templateId,
        templateFound: !!template,
        hasDataContract: !!template?.dataContract,
        dataContractEnginesCount: template?.dataContract?.engines?.length || 0,
        templateSource: template ? (template as any).source : 'not-found',
      });

      if (!template) {
        console.error('[GrammarFlowEditor] ❌ Template not found for load', {
          templateId: node.templateId,
          nodeId: node?.id,
        });
        if (grammar !== null) {
          setGrammar(null);
        }
        return;
      }

      const engines = template?.dataContract?.engines || [];
      console.log('[GrammarFlowEditor] 🔍 Engines analysis', {
        templateId: node.templateId,
        enginesCount: engines.length,
        engineTypes: engines.map((e: any) => e.type),
        grammarFlowEngineFound: !!engines.find((e: any) => e.type === 'grammarflow'),
      });

      const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');
      console.log('[GrammarFlowEditor] 🔍 GrammarFlow engine details', {
        templateId: node.templateId,
        grammarFlowEngineFound: !!grammarFlowEngine,
        hasGrammarFlow: !!grammarFlowEngine?.grammarFlow,
        hasGrammarFlowPascal: !!grammarFlowEngine?.GrammarFlow,
        grammarFlowKeys: grammarFlowEngine ? Object.keys(grammarFlowEngine) : [],
      });

      // ✅ Support both grammarFlow (camelCase) and GrammarFlow (PascalCase from backend)
      const grammarData = grammarFlowEngine?.grammarFlow || grammarFlowEngine?.GrammarFlow;
      if (grammarFlowEngine && grammarData) {
        const loadedGrammar = grammarData as Grammar;
        console.log('[GrammarFlowEditor] ✅ Grammar found and loaded', {
          templateId: node.templateId,
          nodesCount: loadedGrammar.nodes?.length || 0,
          edgesCount: loadedGrammar.edges?.length || 0,
          slotsCount: loadedGrammar.slots?.length || 0,
          semanticSetsCount: loadedGrammar.semanticSets?.length || 0,
          grammarId: loadedGrammar.id,
        });
        setGrammar(loadedGrammar);
      } else {
        // No grammar found - clear state
        console.warn('[GrammarFlowEditor] ⚠️ No grammar found in contract', {
          templateId: node.templateId,
          grammarFlowEngineFound: !!grammarFlowEngine,
          hasGrammarFlow: !!grammarFlowEngine?.grammarFlow,
          hasGrammarFlowPascal: !!grammarFlowEngine?.GrammarFlow,
          grammarDataFound: !!grammarData,
        });
        if (grammar !== null) {
          setGrammar(null);
        }
      }
    } else {
      // No templateId - clear state
      console.log('[GrammarFlowEditor] ⚠️ No templateId, clearing grammar');
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
    console.log('[GrammarFlowEditor] 💾 SAVE START', {
      templateId: node?.templateId,
      nodeId: node?.id,
      grammarNodes: exportedGrammar.nodes.length,
      grammarEdges: exportedGrammar.edges.length,
      grammarSlots: exportedGrammar.slots.length,
      grammarSemanticSets: exportedGrammar.semanticSets.length,
      testPhrasesCount: testPhrases.length,
    });

    setGrammar(exportedGrammar);

    // Save grammar as GrammarFlow engine in contract
    if (node?.templateId) {
      const template = DialogueTaskService.getTemplate(node.templateId);
      if (!template) {
        console.error('[GrammarFlowEditor] ❌ Template not found for save', {
          templateId: node.templateId,
          nodeId: node?.id,
        });
        return;
      }

      console.log('[GrammarFlowEditor] 📋 Template found before save', {
        templateId: node.templateId,
        hasDataContract: !!template.dataContract,
        dataContractEnginesCount: template.dataContract?.engines?.length || 0,
        templateSource: (template as any).source,
        hasGrammarFlowEngine: !!(template.dataContract?.engines?.find((e: any) => e.type === 'grammarflow')),
      });

      if (!template.dataContract) {
        template.dataContract = {
          templateId: node.templateId,
          templateName: template.label || node.templateId,
          subDataMapping: {},
          engines: [],
          outputCanonical: { format: 'value' }
        };
        console.log('[GrammarFlowEditor] 📝 Created new dataContract', {
          templateId: node.templateId,
        });
      }

      const engines = template.dataContract.engines || [];
      const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');

      if (grammarFlowEngine) {
        // Update existing GrammarFlow engine
        console.log('[GrammarFlowEditor] 🔄 Updating existing GrammarFlow engine', {
          templateId: node.templateId,
          hadGrammarFlow: !!grammarFlowEngine.grammarFlow,
          oldNodesCount: grammarFlowEngine.grammarFlow?.nodes?.length || 0,
          newNodesCount: exportedGrammar.nodes.length,
        });
        grammarFlowEngine.grammarFlow = exportedGrammar;
      } else {
        // Create new GrammarFlow engine
        console.log('[GrammarFlowEditor] ➕ Creating new GrammarFlow engine', {
          templateId: node.templateId,
          enginesCountBefore: engines.length,
        });
        engines.push({
          type: 'grammarflow',
          enabled: true,
          grammarFlow: exportedGrammar
        });
        template.dataContract.engines = engines;
      }

      // Save test phrases in DataContract.testPhrases
      template.dataContract.testPhrases = testPhrases;

      console.log('[GrammarFlowEditor] 📊 Template state after grammar save', {
        templateId: node.templateId,
        enginesCount: template.dataContract.engines.length,
        grammarFlowEngineType: template.dataContract.engines.find((e: any) => e.type === 'grammarflow')?.type,
        grammarFlowHasGrammar: !!(template.dataContract.engines.find((e: any) => e.type === 'grammarflow')?.grammarFlow),
        grammarFlowNodesCount: template.dataContract.engines.find((e: any) => e.type === 'grammarflow')?.grammarFlow?.nodes?.length || 0,
        testPhrasesCount: template.dataContract.testPhrases?.length || 0,
        templateSource: (template as any).source,
      });

      // ✅ DEEP LOG: Verify template is still accessible before marking as modified
      const templateBeforeMark = DialogueTaskService.getTemplate(node.templateId);
      console.log('[GrammarFlowEditor] 🔍 Verifying template before markTemplateAsModified', {
        templateId: node.templateId,
        templateFound: !!templateBeforeMark,
        templateHasDataContract: !!templateBeforeMark?.dataContract,
        templateGrammarFlowEngine: templateBeforeMark?.dataContract?.engines?.find((e: any) => e.type === 'grammarflow'),
        templateHasGrammarFlow: !!(templateBeforeMark?.dataContract?.engines?.find((e: any) => e.type === 'grammarflow')?.grammarFlow),
      });

      console.log('[GrammarFlowEditor] 📝 Calling markTemplateAsModified', {
        templateId: node.templateId,
      });
      DialogueTaskService.markTemplateAsModified(node.templateId);
      console.log('[GrammarFlowEditor] ✅ markTemplateAsModified called', {
        templateId: node.templateId,
      });

      console.log('[GrammarFlowEditor] ✅ Grammar saved as GrammarFlow engine', {
        templateId: node.templateId,
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

  // ✅ REGISTER TEMPLATE FOR GRAMMARFLOW SAVE: Track which template has grammarFlow editor open
  // This allows saveAllGrammarFlowFromStore to know which template to update
  useEffect(() => {
    if (node?.templateId) {
      // Register this template as having an open grammarFlow editor
      // We'll use a global map to track this
      const grammarFlowEditors = (window as any).__grammarFlowEditors || new Map();
      grammarFlowEditors.set(node.templateId, true);
      (window as any).__grammarFlowEditors = grammarFlowEditors;

      console.log('[GrammarFlowEditor] 📝 Registered template for grammarFlow save', {
        templateId: node.templateId,
      });

      return () => {
        // Unregister when component unmounts
        const grammarFlowEditors = (window as any).__grammarFlowEditors;
        if (grammarFlowEditors) {
          grammarFlowEditors.delete(node.templateId);
        }
        console.log('[GrammarFlowEditor] 📝 Unregistered template for grammarFlow save', {
          templateId: node.templateId,
        });
      };
    }
  }, [node?.templateId]);

  // ✅ SAVE ON UNMOUNT: Save grammar when component unmounts (user closes editor)
  useEffect(() => {
    return () => {
      // Component is unmounting - save the current grammar if it exists
      const { grammar: currentGrammar } = useGrammarStore.getState();
      if (node?.templateId && currentGrammar) {
        console.log('[GrammarFlowEditor] 🔄 Saving grammar on unmount', {
          templateId: node.templateId,
          nodesCount: currentGrammar.nodes?.length || 0,
        });
        handleGrammarSave(currentGrammar);
      }
    };
  }, [node?.templateId, handleGrammarSave]);

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
          hideToolbar={false} // Show toolbar with close button only
          editorMode="graph"
          initialTestPhrases={testPhrases}
          onTestPhrasesChange={handleTestPhrasesChange}
        />
      </div>
    </div>
  );
}
