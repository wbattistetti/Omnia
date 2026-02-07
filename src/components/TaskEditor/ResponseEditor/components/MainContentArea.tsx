/**
 * MainContentArea
 *
 * Component that renders the main content area of the ResponseEditor:
 * - MessageReview (Personality tab)
 * - DataExtractionEditor (Recognition tab)
 * - BehaviourEditor (Behaviour tab - default)
 *
 * Extracted from ResponseEditorNormalLayout to reduce nesting and improve maintainability.
 */

import React from 'react';
import BehaviourEditor from '@responseEditor/BehaviourEditor';
import MessageReviewView from '@responseEditor/MessageReview/MessageReviewView';
import DataExtractionEditor from '@responseEditor/DataExtractionEditor';
import { getIsTesting } from '@responseEditor/testingState';
import type { Task } from '@types/taskTypes';
import { TabContentContainer } from '@responseEditor/components/TabContentContainer';

export interface MainContentAreaProps {
  // Content state
  showMessageReview: boolean;
  showSynonyms: boolean;

  // Node data
  selectedNode: any;
  selectedRoot: boolean;
  selectedSubIndex: number | null | undefined;

  // Translations
  localTranslations: Record<string, string>;

  // Task data
  task: Task | null | undefined;
  taskType: number;
  mainList: any[];
  selectedIntentIdForTraining: string | null;

  // Handlers
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
  handleProfileUpdate: (partialProfile: any) => void;

  // Contract change tracking
  contractChangeRef: React.MutableRefObject<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any;
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>;

  // Pending editor open
  pendingEditorOpen: { editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'; nodeId: string } | null;
}

/**
 * Component that renders the main content area based on current mode
 */
export function MainContentArea({
  showMessageReview,
  showSynonyms,
  selectedNode,
  selectedRoot,
  selectedSubIndex,
  localTranslations,
  task,
  taskType,
  mainList,
  selectedIntentIdForTraining,
  updateSelectedNode,
  handleProfileUpdate,
  contractChangeRef,
  pendingEditorOpen,
}: MainContentAreaProps) {
  // ✅ Container principale con stili identici all'originale
  const containerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    padding: showMessageReview ? '8px' : '8px 8px 0 8px',
    height: '100%',
    overflow: 'hidden',
  };

  // Personality tab (MessageReview)
  if (showMessageReview) {
    return (
      <div style={containerStyle}>
        <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <MessageReviewView node={selectedNode} translations={localTranslations} updateSelectedNode={updateSelectedNode} />
          </div>
        </div>
      </div>
    );
  }

  // Recognition tab (DataExtractionEditor)
  if (showSynonyms) {
    return (
      <div style={containerStyle}>
        <TabContentContainer padding={6}>
          <DataExtractionEditor
              node={selectedNode}
              taskType={taskType}
              locale={'it-IT'}
              intentSelected={mainList[0]?.kind === 'intent' ? selectedIntentIdForTraining || undefined : undefined}
              task={task}
              updateSelectedNode={updateSelectedNode}
              contractChangeRef={contractChangeRef}
              initialEditor={
                pendingEditorOpen &&
                selectedNode &&
                (selectedNode.id === pendingEditorOpen.nodeId ||
                 selectedNode.templateId === pendingEditorOpen.nodeId)
                  ? pendingEditorOpen.editorType
                  : undefined
              }
              onChange={(profile) => {
                if (getIsTesting()) {
                  return;
                }
                handleProfileUpdate({
                  ...profile,
                  ...(profile.kind && profile.kind !== 'auto' ? { _kindManual: profile.kind } : {}),
                });
              }}
            />
        </TabContentContainer>
      </div>
    );
  }

  // Behaviour tab (default)
  return (
    <div style={containerStyle}>
      <BehaviourEditor
        node={selectedNode}
        translations={localTranslations}
        updateSelectedNode={updateSelectedNode}
        selectedRoot={selectedRoot}
        selectedSubIndex={selectedSubIndex}
      />
    </div>
  );
}
