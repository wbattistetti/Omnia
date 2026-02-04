import { useState } from 'react';
import type { SchemaNode } from '../dataCollection';
import { debug } from '../../../../utils/logger';

export interface FieldErrorState {
  fieldId: string;
  error: string;
  retryCount: number;
  lastAttempt: Date;
}

interface UseMainEditingProps {
  node: SchemaNode;
  autoEdit?: boolean;
  onChange: (node: SchemaNode) => void;
  onChangeEvent?: (e: { type: string; path: string; payload?: any }) => void;
}

export function useMainEditing({ node, autoEdit, onChange, onChangeEvent }: UseMainEditingProps) {
  const [isEditingMain, setIsEditingMain] = useState(!!autoEdit);
  const [labelDraft, setLabelDraft] = useState(autoEdit ? '' : (node.label || ''));
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrorState>>({});
  const [retryLoading, setRetryLoading] = useState<Record<string, boolean>>({});
  const [commitLoading, setCommitLoading] = useState(false);

  const commitMain = async () => {
    debug('MAIN_DATA_WIZARD', 'commitMain called', { labelDraft, currentLabel: node.label, isChanged: (node.label || '') !== labelDraft });

    setCommitLoading(true);

    try {
      if (labelDraft.trim()) {
        const fieldId = labelDraft.trim();
        debug('MAIN_DATA_WIZARD', 'Calling AI for field', { fieldId });

        try {
          // Test error simulation
          if (fieldId === 'test-error') {
            throw new Error('Simulated network error for testing');
          }
          if (fieldId === 'test-http-500') {
            throw new Error('HTTP 500: Internal Server Error');
          }
          if (fieldId === 'test-timeout') {
            throw new Error('Request timeout after 30 seconds');
          }
          if (fieldId === 'test-ai-fail') {
            throw new Error('AI service temporarily unavailable');
          }
          if (fieldId === 'test-network') {
            throw new Error('Network connection failed');
          }
          if (fieldId === 'test-real-network') {
            const fakeResponse = new Response(null, { status: 0, statusText: 'Network Error' });
            throw new Error(`Failed to fetch: ${fakeResponse.statusText}`);
          }
          if (fieldId === 'test-retry-success') {
            const error = fieldErrors[fieldId];
            if (!error || error.retryCount < 2) {
              throw new Error('Simulated retry error - try again');
            }
            debug('MAIN_DATA_WIZARD', 'Simulating success after retries');
          }

          // Get provider/model from localStorage (set by AIProviderContext)
          const provider = localStorage.getItem('omnia.aiProvider') || 'groq';
          const model = localStorage.getItem('omnia.aiModel') || undefined;
          const response = await fetch('/step2-with-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userDesc: fieldId, provider, ...(model && { model }) })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          debug('MAIN_DATA_WIZARD', 'AI Response', data);

          if (data.ai?.mains?.[0]) {
            const aiField = data.ai.mains[0];
            debug('MAIN_DATA_WIZARD', 'Using AI field structure', aiField);

            const updatedNode = {
              ...node,
              label: aiField.label || fieldId,
              type: aiField.type || 'text',
              icon: aiField.icon || 'FileText',
              subData: aiField.subData || [],
              validation: aiField.validation || {},
              example: aiField.example || ''
            };

            debug('MAIN_DATA_WIZARD', 'Updating node with AI structure', updatedNode);
            onChange(updatedNode);
            onChangeEvent?.({ type: 'main.renamed', path: updatedNode.label, payload: { oldPath: node.label || '' } });

            setFieldErrors(prev => {
              const { [fieldId]: removed, ...rest } = prev;
              return rest;
            });

            setIsEditingMain(false);
            return;
          }
        } catch (error) {
          console.error('[MAIN_DATA_WIZARD] ❌ AI call failed:', error);

          setFieldErrors(prev => ({
            ...prev,
            [fieldId]: {
              fieldId,
              error: error instanceof Error ? error.message : 'Unknown error',
              retryCount: (prev[fieldId]?.retryCount || 0) + 1,
              lastAttempt: new Date()
            }
          }));

          debug('MAIN_DATA_WIZARD', 'Field error recorded, keeping editing mode open for retry');
          return;
        }
      }

      setIsEditingMain(false);
      if ((node.label || '') !== labelDraft) {
        const old = node.label || '';
        debug('MAIN_DATA_WIZARD', 'Updating node label', { from: old, to: labelDraft });
        onChange({ ...node, label: labelDraft });
        debug('MAIN_DATA_WIZARD', 'Triggering changeEvent: main.renamed');
        onChangeEvent?.({ type: 'main.renamed', path: labelDraft, payload: { oldPath: old } });
      } else {
        debug('MAIN_DATA_WIZARD', 'No change detected, skipping update');
      }
    } finally {
      setCommitLoading(false);
    }
  };

  const cancelMain = () => {
    setIsEditingMain(false);
    setLabelDraft(node.label || '');
  };

  const retryField = async (fieldId: string) => {
    debug('MAIN_DATA_WIZARD', 'Retrying field', { fieldId });

    setRetryLoading(prev => ({ ...prev, [fieldId]: true }));

    try {
      setFieldErrors(prev => {
        const { [fieldId]: removed, ...rest } = prev;
        return rest;
      });

      await commitMain();
    } finally {
      setRetryLoading(prev => {
        const { [fieldId]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const startEditing = () => {
    setIsEditingMain(true);
    setLabelDraft(node.label || '');
  };

  return {
    isEditingMain,
    labelDraft,
    setLabelDraft,
    fieldErrors,
    retryLoading,
    commitLoading,
    commitMain,
    cancelMain,
    retryField,
    startEditing
  };
}


