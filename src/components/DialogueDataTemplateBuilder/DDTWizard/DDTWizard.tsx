import React, { useState, useEffect, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';
import MainDataCollection, { SchemaNode } from './MainDataCollection';
import V2TogglePanel from './V2TogglePanel';
import { computeWorkPlan } from './workPlan';
import { buildStepPlan, buildPartialPlanForChanges } from './stepPlan';
import { taskCounter } from '../../../utils/TaskCounter';
import { PlanRunResult } from './planRunner';
import { buildArtifactStore, mergeArtifactStores, moveArtifactsPath } from './artifactStore';
import { assembleFinalDDT } from './assembleFinal';
import { Hourglass, Bell } from 'lucide-react';
import { useAIProvider } from '../../../context/AIProviderContext';
import { debug, error } from '../../../utils/logger';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { getTemplateTranslations } from '../../../services/ProjectDataService';
// ResponseEditor will be opened by sidebar after onComplete

// 🚀 NEW: Interface for field processing state
interface FieldProcessingState {
  fieldId: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  retryCount?: number; // Track retry attempts
}

// DEBUG (toggle)
const __DEBUG_DDT_UI__ = false;
const dlog = (...a: any[]) => { if (__DEBUG_DDT_UI__) debug('DDT_WIZARD', a.join(' ')); };

// Piccolo componente per i puntini animati
const AnimatedDots: React.FC<{ intervalMs?: number }> = ({ intervalMs = 450 }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c + 1) % 4), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return <span>{'.'.repeat(count)}</span>;
};

// Tipo per dataNode
interface DataNode {
  name: string;
  subData?: string[];
}

// Auto-Mapping Service (inline to avoid import issues)
interface FieldAnalysis {
  fieldLabel: string;
  analysis: {
    action: 'use_existing' | 'compose' | 'create_new';
    template_source?: string;
    composed_from?: string[];
    mains?: Array<{
      label: string;
      type: string;
      icon: string;
      subData: Array<{
        label: string;
        type: string;
        icon: string;
        validation?: any;
      }>;
    }>;
  };
  provider_used: string;
  timestamp: string;
}

interface TemplateInfo {
  label: string;
  type: string;
  icon: string;
  subData: Array<{
    label: string;
    type: string;
    icon: string;
  }>;
}

class AutoMappingService {
  private templates: TemplateInfo[] = [];

  async initializeTemplates(): Promise<void> {
    try {
      const response = await fetch('/api/factory/dialogue-templates');
      if (response.ok) {
        const data = await response.json();
        this.templates = data.templates || [];
        debug('DDT_WIZARD', 'Loaded templates', { count: this.templates.length });
      }
    } catch (error) {
      console.warn('[AUTO_MAPPING] Failed to load templates:', error);
    }
  }

  async analyzeField(fieldLabel: string, provider: 'openai' | 'groq' = 'openai'): Promise<FieldAnalysis | null> {
    try {
      console.log('[AUTO_MAPPING] Analyzing field:', fieldLabel);

      const response = await fetch('/api/analyze-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabel, provider })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[AUTO_MAPPING] Analysis result:', result.analysis.action);

      return result;
    } catch (error) {
      console.warn('[AUTO_MAPPING] Analysis failed:', error);
      return null;
    }
  }

  async getSuggestedStructure(fieldLabel: string, provider: 'openai' | 'groq' = 'openai'): Promise<TemplateInfo | null> {
    const analysis = await this.analyzeField(fieldLabel, provider);

    if (!analysis) return null;

    if (analysis.analysis.action === 'use_existing' && analysis.analysis.template_source) {
      const template = this.templates.find(t =>
        t.label.toLowerCase().includes(analysis.analysis.template_source!.toLowerCase()) ||
        analysis.analysis.template_source!.toLowerCase().includes(t.label.toLowerCase())
      );

      if (template) {
        console.log('[AUTO_MAPPING] Found matching template:', template.label);
        return template;
      }
    }

    if (analysis.analysis.action === 'create_new' && analysis.analysis.mains?.[0]) {
      const main = analysis.analysis.mains[0];
      return {
        label: main.label,
        type: main.type,
        icon: main.icon,
        subData: main.subData.map(sub => ({
          label: sub.label,
          type: sub.type,
          icon: sub.icon
        }))
      };
    }

    return null;
  }

  shouldAutoMap(fieldLabel: string): boolean {
    const lowerLabel = fieldLabel.toLowerCase();
    const autoMapPatterns = [
      'data', 'date', 'giorno', 'mese', 'anno',
      'nome', 'cognome', 'nominativo',
      'indirizzo', 'via', 'città', 'cap',
      'telefono', 'phone', 'cellulare',
      'email', 'mail',
      'codice', 'code', 'id'
    ];
    return autoMapPatterns.some(pattern => lowerLabel.includes(pattern));
  }
}

const autoMappingService = new AutoMappingService();

const DDTWizard: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void; initialDDT?: any; startOnStructure?: boolean; onSeePrompts?: () => void }> = ({ onCancel, onComplete, initialDDT, startOnStructure, onSeePrompts }) => {
  const API_BASE = '';
  // Ensure accent is inherited in nested components
  React.useEffect(() => {
    try {
      const el = document.querySelector('[data-ddt-section]') as HTMLElement | null;
      if (el) {
        const accent = getComputedStyle(el).getPropertyValue('--ddt-accent');
        if (accent) {
          (document.body.style as any).setProperty('--ddt-accent', accent.trim());
        }
      }
    } catch { }
  }, []);
  // Initialize auto-mapping service
  useEffect(() => {
    autoMappingService.initializeTemplates();
  }, []);

  // Get current project ID from context
  const { getCurrentProjectId } = useProjectDataUpdate();
  const currentProjectId = getCurrentProjectId();

  const [step, setStep] = useState<string>(startOnStructure ? 'structure' : 'input');
  const [saving, setSaving] = useState<'factory' | 'project' | null>(null);

  // Heuristic match confirmation state
  const [pendingHeuristicMatch, setPendingHeuristicMatch] = useState<{
    schema: any;
    icon: string | null;
    mains0: SchemaNode[];
    root: string;
  } | null>(null);

  // Show input alongside confirmation when user clicks "No"
  const [showInputAlongsideConfirm, setShowInputAlongsideConfirm] = useState(false);

  // Schema editing state (from detect schema)
  const [schemaRootLabel, setSchemaRootLabel] = useState<string>(initialDDT?.label || '');
  const [schemaMains, setSchemaMains] = useState<SchemaNode[]>(() => {
    if (initialDDT?.mainData && Array.isArray(initialDDT.mainData)) {
      return (initialDDT.mainData as any[]).map((m: any) => ({
        label: m.label,
        type: m.type,
        icon: m.icon,
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({ label: s.label, type: s.type, icon: s.icon, constraints: s.constraints })) : [],
        constraints: m.constraints
      })) as SchemaNode[];
    }
    return [];
  });

  // Check if DDT is composite (has multiple mainData or is explicitly composite)
  const isCompositeDDT = useMemo(() => {
    return schemaMains.length > 1 ||
           (schemaMains.length === 1 && schemaMains[0]?.subData && schemaMains[0].subData.length > 0);
  }, [schemaMains]);

  // Save template to Factory (global)
  const handleSaveToFactory = async () => {
    if (!schemaRootLabel || schemaMains.length === 0) {
      alert('Please complete the DDT structure before saving');
      return;
    }

    setSaving('factory');
    try {
      const templateData = {
        name: schemaRootLabel.toLowerCase().replace(/\s+/g, '_'),
        label: schemaRootLabel,
        type: isCompositeDDT ? 'composite' : 'atomic',
        icon: 'Folder',
        mainData: schemaMains.map(main => ({
          templateRef: main.type,
          label: main.label,
          type: main.type,
          icon: main.icon,
          subData: main.subData || []
        })),
        synonyms: [], // Can be extended later
        constraints: [],
        validation: {},
        metadata: {}
      };

      const response = await fetch('/api/factory/type-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }

      const saved = await response.json();
      console.log('[DDTWizard] Saved to Factory:', saved);
      alert('Template saved to Factory successfully!');
    } catch (error: any) {
      console.error('[DDTWizard] Error saving to Factory:', error);
      alert(`Error saving to Factory: ${error.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Save template to Project (project-specific)
  const handleSaveToProject = async () => {
    if (!currentProjectId) {
      alert('No project selected. Please open a project first.');
      return;
    }

    if (!schemaRootLabel || schemaMains.length === 0) {
      alert('Please complete the DDT structure before saving');
      return;
    }

    setSaving('project');
    try {
      const templateData = {
        name: schemaRootLabel.toLowerCase().replace(/\s+/g, '_'),
        label: schemaRootLabel,
        type: isCompositeDDT ? 'composite' : 'atomic',
        icon: 'Folder',
        mainData: schemaMains.map(main => ({
          templateRef: main.type,
          label: main.label,
          type: main.type,
          icon: main.icon,
          subData: main.subData || []
        })),
        synonyms: [], // Can be extended later
        constraints: [],
        validation: {},
        metadata: {}
      };

      const response = await fetch(`/api/projects/${currentProjectId}/type-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }

      const saved = await response.json();
      console.log('[DDTWizard] Saved to Project:', saved);
      alert('Template saved to Project successfully!');
    } catch (error: any) {
      console.error('[DDTWizard] Error saving to Project:', error);
      alert(`Error saving to Project: ${error.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Auto-mapping function for manually added fields
  const autoMapFieldStructure = async (fieldLabel: string, fieldIndex: number) => {
    try {
      console.log('[AUTO_MAPPING] Auto-mapping field:', fieldLabel);

      // Check if field should be auto-mapped
      if (!autoMappingService.shouldAutoMap(fieldLabel)) {
        console.log('[AUTO_MAPPING] Field does not need auto-mapping:', fieldLabel);
        return;
      }

      // Get suggested structure
      const suggestedStructure = await autoMappingService.getSuggestedStructure(fieldLabel, selectedProvider.toLowerCase());
      // Note: model is not used in this endpoint yet, can be added later if needed

      if (suggestedStructure && suggestedStructure.subData.length > 0) {
        console.log('[AUTO_MAPPING] Applying structure:', suggestedStructure.subData.length, 'sub-fields');

        // Update the field with suggested structure
        setSchemaMains(prev =>
          prev.map((m, index) =>
            index === fieldIndex
              ? {
                ...m,
                type: suggestedStructure.type,
                icon: suggestedStructure.icon,
                subData: suggestedStructure.subData.map(sub => ({
                  label: sub.label,
                  type: sub.type,
                  icon: sub.icon,
                  constraints: [] // TODO: Implement proper validation constraints later
                }))
              }
              : m
          )
        );

        console.log('[AUTO_MAPPING] ✅ Auto-mapping completed for:', fieldLabel);
      } else {
        console.log('[AUTO_MAPPING] No suitable structure found for:', fieldLabel);
      }
    } catch (error) {
      console.warn('[AUTO_MAPPING] Auto-mapping failed for:', fieldLabel, error);
    }
  };
  const [userDesc, setUserDesc] = useState('');
  // Use global AI provider and model from context
  const { provider: selectedProvider, model: selectedModel } = useAIProvider();
  const [detectTypeIcon, setDetectTypeIcon] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataNode] = useState<DataNode | null>(() => ({ name: initialDDT?.label || '' }));
  const [closed, setClosed] = useState(false);

  // Auto-detect function for real-time heuristic matching
  const handleAutoDetect = React.useCallback(async (text: string) => {
    console.log('[AUTO_DETECT][START]', { text, step, closed, textLength: text.trim().length });

    if (step === 'pipeline' || closed || !text.trim() || text.trim().length < 3) {
      console.log('[AUTO_DETECT][SKIP]', { reason: step === 'pipeline' ? 'pipeline' : closed ? 'closed' : !text.trim() ? 'empty' : 'too_short' });
      return;
    }

    console.log('[AUTO_DETECT][CALL] Starting heuristic detection', { text, step, closed, textLength: text.trim().length });

    try {
      // ✅ Use /step2-with-provider (Node.js) which now has heuristics integrated
      const urlPrimary = `/step2-with-provider`;
      console.log('[AUTO_DETECT][FETCH] Calling /step2-with-provider', { url: urlPrimary, body: { userDesc: text.trim(), provider: selectedProvider.toLowerCase(), model: selectedModel } });

      const response = await fetch(urlPrimary, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDesc: text.trim(), provider: selectedProvider.toLowerCase(), model: selectedModel }),
      });

      console.log('[AUTO_DETECT][RESPONSE] Received', { status: response.status, ok: response.ok, statusText: response.statusText });

      if (!response.ok) {
        console.log('[AUTO_DETECT][ERROR] Response not OK', { status: response.status, statusText: response.statusText });
        // If heuristic fails, silently return (user can click "Invia" for AI)
        return;
      }

      const result = await response.json();
      console.log('[AUTO_DETECT][PARSE] Parsed result', { hasAi: !!result.ai, hasSchema: !!(result.ai || result).schema, resultKeys: Object.keys(result) });

      const ai = result.ai || result;
      console.log('[AUTO_DETECT][AI] AI object', {
        hasSchema: !!ai.schema,
        hasMainData: !!(ai.schema && Array.isArray(ai.schema.mainData)),
        mainDataLength: ai.schema?.mainData?.length || 0,
        label: ai.schema?.label,
        icon: ai.icon
      });

      // ✅ Check if heuristic match was found (has schema.mainData structure)
      if (ai.schema && Array.isArray(ai.schema.mainData) && ai.schema.mainData.length > 0) {
        console.log('[AUTO_DETECT][HEURISTIC_MATCH] ✅ Match found!', {
          label: ai.schema.label,
          mainsCount: ai.schema.mainData.length,
          mains: ai.schema.mainData.map((m: any) => ({ label: m.label, type: m.type, subDataCount: m.subData?.length || 0 }))
        });

        // Instead of processing immediately, save the match and show confirmation
        const schema = ai.schema;
        const root = schema.label || 'Data';
        console.log('[AUTO_DETECT][PROCESS] Preparing match for confirmation', { root, mainsCount: schema.mainData.length });

        const mains0: SchemaNode[] = (schema.mainData || []).map((m: any) => {
          const label = m.label || m.name || 'Field';
          let type = m.type;
          if (!type || type === 'object') {
            const l = String(label).toLowerCase();
            if (/phone|telephone|tel|cellulare|mobile/.test(l)) type = 'phone' as any;
          }

          // ✅ CRITICAL: Process sub-data and preserve stepPrompts
          const processedSubData = Array.isArray(m.subData) ? m.subData.map((s: any) => {
            const hasStepPrompts = !!(s.stepPrompts && typeof s.stepPrompts === 'object' && Object.keys(s.stepPrompts).length > 0);

            if (hasStepPrompts) {
              console.log('✅ [CRITICAL] AUTO_DETECT - SUB-DATA HAS STEPPROMPTS', {
                main: label,
                sub: s.label,
                keys: Object.keys(s.stepPrompts)
              });
            } else {
              console.error('🔴 [CRITICAL] AUTO_DETECT - SUB-DATA MISSING STEPPROMPTS', {
                main: label,
                sub: s.label,
                subKeys: Object.keys(s),
                hasProp: 'stepPrompts' in s
              });
            }

            return {
              label: s.label || s.name || 'Field',
              type: s.type,
              icon: s.icon,
              constraints: [],
              stepPrompts: s.stepPrompts || undefined
            };
          }) : [];

          return {
            label,
            type,
            icon: m.icon,
            constraints: [],
            subData: processedSubData,
            // Include stepPrompts from template match if present
            stepPrompts: m.stepPrompts || schema.stepPrompts || null
          } as any;
        });

        // Save match for confirmation and immediately set schema to show structure
        setPendingHeuristicMatch({ schema, icon: ai.icon || null, mains0, root });
        setShowInputAlongsideConfirm(false); // Reset when new match is found
        setSchemaRootLabel(root);
        setSchemaMains(mains0);
        setDetectTypeIcon(ai.icon || null);
        setShowRight(true); // Show right panel for confirmation
        setStep('heuristic-confirm'); // Show confirmation step with structure
        console.log('[AUTO_DETECT][CONFIRM] Match saved, showing confirmation with structure', { root, mainsCount: mains0.length });
        return;
      }

      // No heuristic match found - user will need to click "Invia" for AI
      console.log('[AUTO_DETECT][NO_MATCH] No heuristic match found', {
        hasSchema: !!ai.schema,
        hasMainData: !!(ai.schema && Array.isArray(ai.schema.mainData)),
        mainDataLength: ai.schema?.mainData?.length || 0
      });
      debug('DDT_WIZARD', 'No heuristic match, AI will be called on submit');

    } catch (error) {
      // Silently fail - user can still use "Invia" button for AI
      console.error('[AUTO_DETECT][ERROR] Exception caught', { error, message: (error as any)?.message, stack: (error as any)?.stack });
      debug('DDT_WIZARD', 'Auto-detect error (non-blocking)', error);
    }
  }, [step, closed, selectedProvider, selectedModel]);
  // removed unused refs

  // Schema editing state is already declared above (moved to fix initialization order)
  // removed local artifacts/editor state; we now rely on onComplete to open editor via sidebar
  const [isProcessing, setIsProcessing] = useState(false);
  // 🚀 REPLACED: progressByPath con TaskCounter
  const [taskProgress, setTaskProgress] = useState<Record<string, number>>({});
  const [rootProgress, setRootProgress] = useState<number>(0);

  // 🚀 NEW: State for field processing states
  const [fieldProcessingStates, setFieldProcessingStates] = useState<Record<string, FieldProcessingState>>({});

  // 🚀 NEW: Handle retry for a specific field
  const handleRetryField = async (fieldId: string) => {
    console.log('[DDTWizard] Retry requested for field:', fieldId);
    const parts = fieldId.split('/');
    const mainLabel = parts[0];
    const subLabel = parts.length > 1 ? parts[1] : undefined;

    // Find the main node
    const mainNode = schemaMains.find(m => m.label === mainLabel);
    if (!mainNode) {
      console.error('[DDTWizard] Main node not found:', mainLabel);
      return;
    }

    // Find the target node (main or sub)
    const targetNode = subLabel
      ? (mainNode.subData || []).find(s => s.label === subLabel)
      : mainNode;

    if (!targetNode) {
      console.error('[DDTWizard] Target node not found:', fieldId);
      return;
    }

    // Update state to processing, preserving retryCount
    setFieldProcessingStates(prev => {
      const currentRetryCount = prev[fieldId]?.retryCount ?? 0;
      console.log('[DDTWizard] Starting retry for field:', fieldId, 'preserving retryCount:', currentRetryCount);
      return {
        ...prev,
        [fieldId]: {
          fieldId,
          status: 'processing',
          progress: 0,
          message: 'Rigenerando messaggi...',
          timestamp: new Date(),
          retryCount: currentRetryCount // 🚀 FIX: Preserve retryCount when starting retry
        }
      };
    });

    try {
      // Regenerate messages for this specific field
      // TODO: Implementare logica per rigenerare solo i messaggi per questo campo specifico
      // Chiamare gli endpoint API necessari solo per questo campo
      const messageEndpoints = [
        { type: 'startPrompt', endpoint: '/api/startPrompt' },
        { type: 'noMatchPrompts', endpoint: '/api/stepNoMatch' },
        { type: 'noInputPrompts', endpoint: '/api/stepNoInput' },
        { type: 'confirmationPrompts', endpoint: '/api/stepConfirmation' },
        { type: 'successPrompts', endpoint: '/api/stepSuccess' },
      ];

      const mainDataName = mainLabel;
      const subDataName = subLabel || mainLabel;

      for (let i = 0; i < messageEndpoints.length; i++) {
        const { endpoint } = messageEndpoints[i];

        // Update progress, preserving retryCount
        const progress = Math.round((i + 1) / messageEndpoints.length * 100);
        setFieldProcessingStates(prev => ({
          ...prev,
          [fieldId]: {
            ...prev[fieldId],
            progress,
            message: `Generando ${messageEndpoints[i].type}...`,
            retryCount: prev[fieldId]?.retryCount ?? 0 // 🚀 FIX: Preserve retryCount during progress updates
          }
        }));

        const body = subLabel ? {
          meaning: subDataName,
          desc: `Generate a concise, direct message for ${subDataName}.`,
          provider: selectedProvider.toLowerCase(),
        } : {
          meaning: mainDataName,
          desc: '',
          provider: selectedProvider.toLowerCase(),
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`${endpoint} failed: ${res.status} ${errorText}`);
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 300));
      }

      // Success - update to completed, clear retryCount on success
      setFieldProcessingStates(prev => ({
        ...prev,
        [fieldId]: {
          fieldId,
          status: 'completed',
          progress: 100,
          message: 'Done!',
          timestamp: new Date(),
          retryCount: 0 // 🚀 Reset retryCount on success
        }
      }));

      console.log('[DDTWizard] Retry completed successfully for field:', fieldId);
    } catch (error: any) {
      console.error('[DDTWizard] Retry failed for field:', fieldId, error);

      // Update to error state with incremented retryCount
      setFieldProcessingStates(prev => {
        const currentRetryCount = prev[fieldId]?.retryCount ?? 0;
        const newRetryCount = currentRetryCount + 1;
        console.log('[DDTWizard] Retry failed, incrementing retryCount:', fieldId, 'from', currentRetryCount, 'to', newRetryCount);
        return {
          ...prev,
          [fieldId]: {
            fieldId,
            status: 'error',
            progress: prev[fieldId]?.progress || 0,
            message: `Errore generazione messaggi: ${error.message || 'Unknown error'}`,
            timestamp: new Date(),
            retryCount: newRetryCount
          }
        };
      });
    }
  };

  // 🚀 NEW: Handle manual creation - assemble DDT with existing messages and open editor
  const handleCreateManually = () => {
    console.log('[DDTWizard] Manual creation requested - assembling DDT and opening editor');

    // Assemble minimal DDT from current structure
    const minimalDDT = assembleMinimalDDT();

    // Call onComplete to open the editor with the minimal DDT
    // The user can then manually add messages in the Response Editor
    if (onComplete) {
      handleClose(minimalDDT);
    } else {
      handleClose();
    }
  };
  const [playChime, setPlayChime] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('ddtWizard.playChime');
      if (v === null) return true; // default true
      return v === '1';
    } catch {
      return true;
    }
  });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [autoEditIndex, setAutoEditIndex] = useState<number | null>(null);
  const [changes, setChanges] = useState<Record<string, Set<string>>>({
    mains: new Set(),
    subs: new Set(),
    constraints: new Set(),
  });
  const [currentProcessingLabel, setCurrentProcessingLabel] = useState<string>('');
  // Parallel processing: accumulate partial DDT results for each main
  const [partialResults, setPartialResults] = useState<Record<number, any>>({});
  // Ref to track when all mains are completed and we should close
  const pendingCloseRef = React.useRef<{ ddt: any; translations: any } | null>(null);
  // Persisted artifacts across runs for incremental assemble
  const [artifactStore, setArtifactStore] = useState<any | null>(null);
  // Track pending renames to relocate artifacts keys between normalized paths
  const [pendingRenames, setPendingRenames] = useState<Array<{ from: string; to: string }>>([]);

  // Memo per dataNode stabile
  const stableDataNode = useMemo(() => dataNode, [dataNode]);

  useEffect(() => {
    return () => {
    };
  }, []);

  // Two-panel layout: show results panel at right after user clicks Continue on the left
  const [showRight, setShowRight] = useState<boolean>(startOnStructure ? true : false);

  // Auto-collapse/expand: quando un main data raggiunge 100%, passa automaticamente al successivo
  useEffect(() => {
    if (step !== 'pipeline') return;
    if (schemaMains.length === 0) return;

    const currentMain = schemaMains[selectedIdx];
    if (!currentMain) return;

    const currentMainProgress = taskProgress[currentMain.label] || 0;

    // Se il main corrente ha raggiunto 100%, cerca il prossimo non completato
    if (currentMainProgress >= 0.99) { // 0.99 per tolleranza float
      const nextIdx = schemaMains.findIndex((m, i) =>
        i > selectedIdx && (taskProgress[m.label] || 0) < 0.99
      );

      if (nextIdx !== -1) {
        // Auto-espandi il prossimo main data
        try {
          console.log(`[DDT][auto-advance] ${currentMain.label} completed (${Math.round(currentMainProgress * 100)}%) → opening ${schemaMains[nextIdx].label}`);
        } catch { }
        setSelectedIdx(nextIdx);
      }
    }
  }, [taskProgress, selectedIdx, schemaMains, step]);

  // Effect to handle closing when all mains are completed
  React.useEffect(() => {
    if (!pendingCloseRef.current) return;

    if (pendingCloseRef.current && schemaMains.length > 0) {
      const completedCount = Object.keys(partialResults).length;
      // Only close if all mains are completed
      if (completedCount === schemaMains.length) {
        const { ddt, translations } = pendingCloseRef.current;
        pendingCloseRef.current = null; // Clear before calling to avoid re-triggering
        // Use setTimeout to defer to next tick, avoiding setState during render
        setTimeout(() => {
          handleClose(ddt, translations);
        }, 0);
      }
    }
  }, [partialResults, schemaMains.length]);

  // DataNode stabile per pipeline (evita rilanci causati da oggetti inline)
  const pipelineDataNode = React.useMemo(() => {
    const main0 = schemaMains[selectedIdx] || schemaMains[0] || ({} as any);
    return {
      name: (main0 as any)?.label || 'Data',
      type: (main0 as any)?.type,
      subData: ((main0 as any)?.subData || []) as any[],
    } as any;
  }, [schemaMains, selectedIdx]);

  // Funzione per chiamare la detection AI
  const handleDetectType = async () => {
    if (step === 'pipeline' || closed) return; // Blocca ogni setState durante la pipeline
    setShowRight(true);
    setStep('loading');
    try { dlog('[DDT][UI] step → loading'); } catch { }
    setErrorMsg(null);
    try {
      const reqBody = userDesc.trim();
      console.log('[DDT][DetectType] 🚀 Starting detection for:', reqBody);
      console.log('[DDT][DetectType] 📊 Current state:', { step, closed, userDesc: reqBody });

      // Clean path via Vite proxy
      const urlPrimary = `/step2-with-provider`;
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      console.log('[DDT][DetectType][request]', { url: urlPrimary, body: reqBody, provider: selectedProvider, providerLower: selectedProvider.toLowerCase() });
      const ctrl = new AbortController();
      const timeoutMs = 60000; // 60 seconds - increased for enterprise AI
      const timeoutId = setTimeout(() => { try { ctrl.abort(); console.warn('[DDT][DetectType][timeout]', { url: urlPrimary, timeoutMs }); } catch { } }, timeoutMs);
      let res = await fetch(urlPrimary, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDesc: reqBody, provider: selectedProvider.toLowerCase(), model: selectedModel }),
        signal: ctrl.signal as any,
      });
      clearTimeout(timeoutId);
      const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
      let raw = '';
      try { raw = await res.clone().text(); } catch { }
      console.log('[DDT][DetectType][response]', { status: res.status, ok: res.ok, ms: Math.round(elapsed), preview: (raw || '').slice(0, 400) });
      if (!res.ok) throw new Error('Errore comunicazione IA');
      const result = await res.json();
      console.log('[DDT][DetectType][parsed]', result);
      const ai = result.ai || result;

      console.log('[DDT][DetectType] 🤖 AI Response analysis:', {
        action: ai.action,
        label: ai.label,
        type: ai.type,
        icon: ai.icon,
        mainsCount: ai.mains?.length || 0,
        hasValidation: ai.mains?.some(m => m.validation) || false,
        hasExamples: ai.mains?.some(m => m.example) || false,
        hasSchema: !!ai.schema,
        schemaMainDataCount: ai.schema?.mainData?.length || 0
      });

      // Handle new AI response structure
      let schema;
      if (ai.schema && Array.isArray(ai.schema.mainData)) {
        // Old structure: ai.schema.mainData
        schema = ai.schema;
        console.log('[DDT][DetectType] 📋 Using schema.mainData structure');
      } else if (Array.isArray(ai.mains)) {
        // New structure: ai.mains directly
        schema = {
          label: ai.label || 'Data',
          mainData: ai.mains
        };
        console.log('[DDT][DetectType] 📋 Using ai.mains structure');
      } else {
        throw new Error('Schema non valido');
      }

      console.log('[DDT][DetectType][schema]', schema);
      if (schema && Array.isArray(schema.mainData)) {
        const root = schema.label || 'Data';
        const mains0: SchemaNode[] = (schema.mainData || []).map((m: any) => {
          const label = m.label || m.name || 'Field';
          let type = m.type;
          // Canonicalize type at fallback: map Telephone/Phone to 'phone'
          if (!type || type === 'object') {
            const l = String(label).toLowerCase();
            if (/phone|telephone|tel|cellulare|mobile/.test(l)) type = 'phone' as any;
          }
          return {
            label,
            type,
            icon: m.icon,
            constraints: [], // TODO: Implement proper validation constraints later
            subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
              label: s.label || s.name || 'Field',
              type: s.type,
              icon: s.icon,
              constraints: [] // TODO: Implement proper validation constraints later
            })) : [],
          } as any;
        });
        setDetectTypeIcon(ai.icon || null);
        // Enrich constraints immediately, then show structure step
        console.log('[DDT][DetectType] → enrichConstraints', { root, mainsCount: mains0.length });
        const enrichedRes = await enrichConstraintsFor(root, mains0);
        console.log('[DDT][DetectType][enrich.done]', enrichedRes);
        const finalRoot = (enrichedRes && (enrichedRes as any).label) ? (enrichedRes as any).label : root;
        let finalMains: any[] = (enrichedRes && (enrichedRes as any).mains) ? (enrichedRes as any).mains as any[] : mains0 as any[];
        // Fallback: se nessuna subData proposta, inferisci dal testo utente
        try {
          const inferred = inferSubDataFromText(userDesc);
          if (Array.isArray(finalMains) && finalMains.length > 0 && (!finalMains[0].subData || finalMains[0].subData.length === 0) && inferred.length > 0) {
            finalMains = [{ ...finalMains[0], subData: inferred }];
          }
        } catch { }
        // If AI returned multiple atomic mains (no subData), wrap them into a single aggregator main using the root label
        const allAtomic = Array.isArray(finalMains) && finalMains.length > 1 && finalMains.every((m: any) => !Array.isArray((m as any)?.subData) || (m as any).subData.length === 0);
        if (allAtomic) {
          finalMains = [{ label: finalRoot, type: 'object', icon: 'Folder', subData: finalMains }];
          debug('DDT_WIZARD', 'Wrapped atomic mains into aggregator', { finalRoot, count: finalMains[0].subData.length });
        }
        setSchemaRootLabel(finalRoot);
        setSchemaMains(finalMains);
        setStep('structure');
        try { dlog('[DDT][UI] step → structure', { root: finalRoot, mains: finalMains.length }); } catch { }
        return;
      }
      console.warn('[DDT][DetectType][invalidSchema]', { schema });
      throw new Error('Schema non valido');
    } catch (err: any) {
      console.error('[DDT][Wizard][error]', err);
      const msg = (err && (err.name === 'AbortError' || err.message === 'The operation was aborted.')) ? 'Timeout step2' : (err.message || '');
      setErrorMsg('Errore IA: ' + msg);
      setStep('error');
      try { dlog('[DDT][UI] step → error'); } catch { }
    }
  };

  // removed old continue

  // Assembla un DDT minimale dalla struttura corrente (root + mains + subData)
  const assembleMinimalDDT = () => {
    const root = (schemaRootLabel || 'Data');
    const mains = (schemaMains || []).map((m) => ({
      label: m.label || 'Field',
      type: m.type,
      icon: (m as any).icon,
      constraints: (m as any).constraints,
      subData: (m.subData || []).map((s) => ({
        label: s.label || 'Field',
        type: s.type,
        icon: (s as any).icon,
        constraints: (s as any).constraints,
      }))
    }));
    // preserva id/_id e translations dall'initialDDT per evitare rimbalzi
    const baseId = (initialDDT as any)?.id || (initialDDT as any)?._id;
    const ddt = {
      ...(baseId ? { id: (initialDDT as any)?.id || baseId } : {}),
      ...(((initialDDT as any)?._id && !(initialDDT as any)?.id) ? { _id: (initialDDT as any)._id } : {}),
      label: root,
      mainData: mains,
      ...(initialDDT && (initialDDT as any).translations ? { translations: (initialDDT as any).translations } : {}),
    } as any;
    try {
      debug('DDT_WIZARD', 'Assembling DDT', { root, mainsCount: mains.length, mainsLabels: mains.map(m => m.label), preservedId: baseId });
    } catch { }
    return ddt;
  };

  // Heuristic: infer simple subData list from user description when AI doesn't provide it
  function inferSubDataFromText(text: string): Array<{ label: string; type?: string; icon?: string }> {
    try {
      const t = (text || '').toLowerCase();
      const out: Array<{ label: string; type?: string; icon?: string }> = [];
      const add = (label: string, type?: string) => {
        if (!out.some(x => x.label.toLowerCase() === label.toLowerCase())) out.push({ label, type });
      };
      if (/country\s*code|prefisso\s*internazionale/.test(t)) add('Country code', 'string');
      if (/area\s*code|prefisso\s*area|prefisso\s*citt[aà]/.test(t)) add('Area code', 'string');
      if (/\bnumber|numero\b/.test(t)) add('Number', 'string');
      return out;
    } catch {
      return [];
    }
  }

  const enrichConstraintsFor = async (rootLabelIn: string, mainsIn: SchemaNode[]) => {
    try {
      const schema = { label: rootLabelIn || 'Data', mains: mainsIn.map((m) => ({ label: m.label, type: m.type, icon: m.icon, subData: (m.subData || []).map(s => ({ label: s.label, type: s.type, icon: s.icon })) })), text: userDesc };
      try { console.log('[DDT][Constraints][request]', { url: '/step3', body: schema }); } catch { }
      const res = await fetch(`/step3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schema)
      });
      if (!res.ok) {
        console.warn('[DDT][Constraints][response.notOk]', { status: res.status });
        return;
      }
      const result = await res.json();
      console.log('[constraints] raw result', result);
      const enriched: any = (result && result.ai && result.ai.schema) ? result.ai.schema : {};
      console.log('[constraints] enriched schema', enriched);
      if (!!enriched && typeof enriched === 'object' && Array.isArray((enriched as any).mainData)) {
        const norm = (v: any) => (v || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
        const enrichedMap = new Map<string, any>();
        for (const m of (enriched as any).mainData) enrichedMap.set(norm(m.label), m);
        const nextMains = mainsIn.map((existing) => {
          const em = enrichedMap.get(norm(existing.label));
          let nextSub = existing.subData || [];

          console.log('[DDT][Constraints][enrich] 🔍 PROCESSING MAIN FOR CONSTRAINTS', {
            mainLabel: existing.label,
            hasStepPrompts: !!(existing as any).stepPrompts,
            subDataCount: nextSub.length,
            subDataItems: nextSub.map((s: any) => ({
              label: s.label,
              hasStepPrompts: !!(s as any).stepPrompts,
              stepPrompts: (s as any).stepPrompts
            }))
          });

          if (em && Array.isArray(em.subData) && nextSub.length > 0) {
            const subMap = new Map<string, any>();
            for (const s of em.subData) subMap.set(norm(s.label), s);
            nextSub = nextSub.map((sub) => {
              const es = subMap.get(norm(sub.label));

              console.log('[DDT][Constraints][enrich] 🔍 PROCESSING SUB DATA FOR CONSTRAINTS', {
                mainLabel: existing.label,
                subLabel: sub.label,
                hasExistingStepPrompts: !!(sub as any).stepPrompts,
                existingStepPrompts: (sub as any).stepPrompts,
                hasEnrichedConstraints: Array.isArray(es?.constraints),
                enrichedConstraintsCount: Array.isArray(es?.constraints) ? es.constraints.length : 0
              });

              // Preserva stepPrompts se presenti, aggiungi solo i constraints dall'AI
              const preservedStepPrompts = (sub as any).stepPrompts || undefined;
              const result = {
                ...sub,
                constraints: Array.isArray(es?.constraints) ? es.constraints : [],
                ...(preservedStepPrompts ? { stepPrompts: preservedStepPrompts } : {})
              };

              console.log('[DDT][Constraints][enrich] ✅ SUB DATA RESULT', {
                mainLabel: existing.label,
                subLabel: sub.label,
                hasStepPrompts: !!(result as any).stepPrompts,
                stepPrompts: (result as any).stepPrompts,
                constraintsCount: Array.isArray(result.constraints) ? result.constraints.length : 0
              });

              return result;
            });
          } else {
            // Anche se non ci sono enriched subData, preserva i stepPrompts esistenti
            nextSub = nextSub.map((sub) => {
              const preservedStepPrompts = (sub as any).stepPrompts || undefined;
              return {
                ...sub,
                ...(preservedStepPrompts ? { stepPrompts: preservedStepPrompts } : {})
              };
            });
          }
          // Dedupe helper
          const dedupe = (arr?: any[]) => {
            const seen = new Set<string>();
            const out: any[] = [];
            for (const c of (arr || [])) {
              const k = JSON.stringify({ t: (c as any)?.title || '', p: (c as any)?.payoff || '' }).toLowerCase();
              if (!seen.has(k)) { seen.add(k); out.push(c); }
            }
            return out;
          };
          // Usa SOLO i constraints restituiti dall'AI anche per il main
          const mainConstraints = Array.isArray(em?.constraints) ? dedupe(em!.constraints) : [];
          // Dedupe per i sub
          nextSub = nextSub.map(s => ({ ...s, constraints: dedupe((s as any).constraints) }));
          // CRITICAL: Preserve stepPrompts if they exist
          const preservedStepPrompts = (existing as any).stepPrompts || null;
          return { ...existing, constraints: mainConstraints, subData: nextSub, ...(preservedStepPrompts ? { stepPrompts: preservedStepPrompts } : {}) };
        });
        return { label: ((enriched as any).label || rootLabelIn) as string, mains: nextMains };
      }
      return { label: rootLabelIn, mains: mainsIn };
    } catch (e) {
      // ignore constraints errors for now
      console.error('[constraints] error fetching constraints', e);
      return { label: rootLabelIn, mains: mainsIn };
    }
  };

  // fetchConstraints no longer used in structure step

  const handleAddMain = () => {
    setSchemaMains(prev => {
      const next = [...prev, { label: '', type: 'object', subData: [] } as any];
      // auto-select new and enable inline edit
      setSelectedIdx(next.length - 1);
      setAutoEditIndex(next.length - 1);
      // change tracking
      try { setChanges(p => ({ ...p, mains: new Set([...p.mains, '']) })); } catch { }
      return next;
    });
  };

  const handleChangeEvent = (e: { type: string; path: string; payload?: any }) => {
    console.log('[DDT_WIZARD] 🔔 handleChangeEvent called:', {
      type: e.type,
      path: e.path,
      payload: e.payload
    });

    setChanges(prev => {
      const next = {
        mains: new Set(prev.mains),
        subs: new Set(prev.subs),
        constraints: new Set(prev.constraints),
      };
      const addOnce = (set: Set<string>, v?: string) => { if (v && v.trim()) set.add(v); };
      if (e.type.startsWith('sub.')) { addOnce(next.subs, e.path); addOnce(next.subs, e.payload?.oldPath); }
      if (e.type.startsWith('constraint.')) { addOnce(next.constraints, e.path); }
      if (e.type.startsWith('main.')) { addOnce(next.mains, e.path); addOnce(next.mains, e.payload?.oldPath); }
      return next;
    });
    // If rename, record from/to normalized paths so we can move artifacts on refine
    if (e.type === 'main.renamed') {
      const from = (e.payload?.oldPath || '').replace(/\//g, '-');
      const to = (e.path || '').replace(/\//g, '-');
      if (from && to && from !== to) setPendingRenames(list => [...list, { from, to }]);
    }
    if (e.type === 'sub.renamed') {
      const old = String(e.payload?.oldPath || '');
      const neu = String(e.path || '');
      const from = old.split('/').map(p => p.replace(/\//g, '-')).join('/');
      const to = neu.split('/').map(p => p.replace(/\//g, '-')).join('/');
      if (from && to && from !== to) setPendingRenames(list => [...list, { from, to }]);
    }
  };

  // Handler per chiusura (annulla o completamento)
  const handleClose = (result?: any, messages?: any) => {
    debug('DDT_WIZARD', 'Handle close', { hasResult: !!result, hasOnComplete: !!onComplete, resultId: result?.id, resultLabel: result?.label, mainsCount: Array.isArray(result?.mainData) ? result.mainData.length : 'not-array' });
    setClosed(true);
    if (result && onComplete) {
      debug('DDT_WIZARD', 'Calling onComplete callback');
      onComplete(result, messages);
    } else {
      debug('DDT_WIZARD', 'Calling onCancel');
      onCancel();
    }
  };

  // Se chiuso, non renderizzare nulla
  if (closed) return null;

  // Two-panel layout render (simplified, as requested)
  const rightHasContent = Boolean(
    showRight && (
      step === 'loading' ||
      step === 'heuristic-confirm' ||
      (step === 'structure' && Array.isArray(schemaMains) && schemaMains.length > 0) ||
      step === 'pipeline' || step === 'error' || step === 'support'
    )
  );

  // Debug: Log rightHasContent state
  React.useEffect(() => {
    console.log('[DDT][Wizard][rightHasContent]', {
      rightHasContent,
      showRight,
      step,
      hasSchemaMains: Array.isArray(schemaMains) && schemaMains.length > 0,
      schemaMainsCount: Array.isArray(schemaMains) ? schemaMains.length : 0,
      pendingHeuristicMatch: !!pendingHeuristicMatch
    });
  }, [rightHasContent, showRight, step, schemaMains, pendingHeuristicMatch]);
  const pipelineHeadless = true; // run pipeline headlessly; show progress under structure
  const renderTogglePanel = step !== 'pipeline';
  try { dlog('[DDT][UI] render', { step, showRight, rightHasContent, pipelineHeadless, renderTogglePanel }); } catch { }

  // Handle manual template selection
  const handleTemplateSelect = React.useCallback((template: any) => {
    console.log('[DDT][Wizard][templateSelect] Template selected manually:', template.label);

    // Convert template to heuristic match format
    const root = template.label || 'Data';
    const mainData = template.mainData || [];

    const mains0: SchemaNode[] = mainData.map((m: any) => {
      const label = m.label || m.name || 'Field';
      let type = m.type;
      if (!type || type === 'object') {
        const l = String(label).toLowerCase();
        if (/phone|telephone|tel|cellulare|mobile/.test(l)) type = 'phone' as any;
      }
      return {
        label,
        type,
        icon: m.icon,
        constraints: m.constraints || [],
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          label: s.label || s.name || 'Field',
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || []
        })) : [],
        // Include stepPrompts from template if present
        stepPrompts: m.stepPrompts || template.stepPrompts || null
      } as any;
    });

    // Create a fake schema for consistency
    const schema = {
      label: root,
      mainData: mains0
    };

    // Process as if it were a heuristic match
    setPendingHeuristicMatch({ schema, icon: template.icon || null, mains0, root });
    setShowInputAlongsideConfirm(false);
    setSchemaRootLabel(root);
    setSchemaMains(mains0);
    setDetectTypeIcon(template.icon || null);
    setShowRight(true);
    setStep('heuristic-confirm');
    console.log('[DDT][Wizard][templateSelect] Template processed, showing confirmation', { root, mainsCount: mains0.length });
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showInputAlongsideConfirm
          ? 'minmax(420px,520px) minmax(420px,520px) 1fr'
          : rightHasContent
            ? 'minmax(420px,520px) 1fr'
            : '1fr',
        gap: 12,
        height: '100%',
      }}
    >
      {/* Show WizardInputStep if:
          - NO pendingHeuristicMatch (no heuristic found)
          - OR showInputAlongsideConfirm is true (user clicked "No") */}
      <div style={{
        overflow: 'auto',
        padding: '0 8px',
        display: (pendingHeuristicMatch && !showInputAlongsideConfirm) ? 'none' : 'block'
      }}>
        <WizardInputStep
          userDesc={userDesc}
          setUserDesc={setUserDesc}
          onNext={handleDetectType}
          onCancel={handleClose}
          dataNode={stableDataNode || undefined}
          onAutoDetect={handleAutoDetect}
          onTemplateSelect={handleTemplateSelect}
        />
      </div>

      {/* Confirmation panel - show if pendingHeuristicMatch exists */}
      {pendingHeuristicMatch && (
        <div style={{ overflow: 'auto', borderLeft: '1px solid #1f2340', padding: 12 }}>
          {step === 'heuristic-confirm' && pendingHeuristicMatch && (() => {
            const { schema, icon, mains0, root } = pendingHeuristicMatch;
            const displayMains = schemaMains.length > 0 ? schemaMains : mains0;
            const displayRoot = schemaRootLabel || root;

            return (
              <div style={{ padding: 4 }}>
                {/* Confirmation header */}
                <div style={{
                  padding: 16,
                  background: '#1e293b',
                  borderRadius: 8,
                  marginBottom: 12,
                  border: '1px solid #334155'
                }}>
                  <p style={{ color: '#e2e8f0', marginBottom: 12, fontSize: 16, fontWeight: 500 }}>
                    I guess you want to retrieve this below is that correct?
                  </p>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={async () => {
                        console.log('[DDT][Wizard][heuristicMatch] User confirmed, processing match');

                        const { schema, icon, mains0, root } = pendingHeuristicMatch;
                        setPendingHeuristicMatch(null);
                        setShowInputAlongsideConfirm(false); // Reset when confirming
                        setDetectTypeIcon(icon);

                        // Check if stepPrompts are present
                        const hasStepPrompts = mains0.some((m: any) => m.stepPrompts && Object.keys(m.stepPrompts).length > 0);
                        console.log('[DDT][Wizard][heuristicMatch] Checking stepPrompts', { hasStepPrompts, mainsCount: mains0.length });

                        if (hasStepPrompts) {
                          // If stepPrompts are present, go directly to Response Editor
                          console.log('[DDT][Wizard][heuristicMatch] stepPrompts found, going directly to Response Editor');

                          try {
                            // Extract all translation keys from stepPrompts
                            // stepPrompts structure: { start: ['template.time.start.prompt1'], noMatch: [...], ... }
                            const translationKeys: string[] = [];

                            // ✅ CRITICAL: Check if sub-data have stepPrompts BEFORE processing
                            console.log('🔴 [CRITICAL] SUB-DATA STEPPROMPTS CHECK', {
                              mainsCount: mains0.length,
                              mains: mains0.map((m: any) => ({
                                label: m.label,
                                subDataCount: (m.subData || []).length,
                                subData: (m.subData || []).map((s: any) => ({
                                  label: s.label,
                                  HAS_STEPPROMPTS: !!(s as any).stepPrompts,
                                  stepPromptsKeys: (s as any).stepPrompts ? Object.keys((s as any).stepPrompts) : [],
                                  stepPrompts: (s as any).stepPrompts
                                }))
                              }))
                            });

                            mains0.forEach((m: any) => {

                              // Process main data stepPrompts
                              if (m.stepPrompts && typeof m.stepPrompts === 'object') {
                                Object.entries(m.stepPrompts).forEach(([stepKey, stepPromptKeys]: [string, any]) => {
                                  // stepPromptKeys is already an array of keys, not an object with .keys property
                                  if (Array.isArray(stepPromptKeys) && stepPromptKeys.length > 0) {
                                    console.log('[DDT][Wizard][heuristicMatch] Found stepPrompts for step', {
                                      mainLabel: m.label,
                                      stepKey,
                                      keys: stepPromptKeys,
                                      allAreTemplateKeys: stepPromptKeys.every((k: string) => k.startsWith('template.'))
                                    });
                                    translationKeys.push(...stepPromptKeys);
                                  }
                                });
                              }

                              // Process sub data stepPrompts
                              if (m.subData && Array.isArray(m.subData) && m.subData.length > 0) {
                                m.subData.forEach((sub: any, subIdx: number) => {
                                  const hasSubStepPrompts = !!(sub as any).stepPrompts && typeof (sub as any).stepPrompts === 'object' && Object.keys((sub as any).stepPrompts).length > 0;

                                  if (hasSubStepPrompts) {
                                    Object.entries((sub as any).stepPrompts).forEach(([stepKey, stepPromptKeys]: [string, any]) => {
                                      if (Array.isArray(stepPromptKeys) && stepPromptKeys.length > 0) {
                                        stepPromptKeys.forEach((key: string) => {
                                          if (key.startsWith('template.')) {
                                            translationKeys.push(key);
                                          }
                                        });
                                      }
                                    });
                                  } else {
                                    console.error('🔴 [CRITICAL] SUB-DATA MISSING STEPPROMPTS', {
                                      mainLabel: m.label,
                                      subLabel: sub.label,
                                      subKeys: Object.keys(sub),
                                      hasStepPromptsProp: 'stepPrompts' in sub
                                    });
                                  }
                                });
                              }
                            });

                            console.log('[DDT][Wizard][heuristicMatch] Extracted translation keys:', {
                              totalKeys: translationKeys.length,
                              uniqueKeys: [...new Set(translationKeys)].length,
                              keys: translationKeys,
                              templateKeys: translationKeys.filter(k => k.startsWith('template.')),
                              nonTemplateKeys: translationKeys.filter(k => !k.startsWith('template.'))
                            });

                            // Load translations from database
                            let templateTranslations: Record<string, { en: string; it: string; pt: string }> = {};
                            if (translationKeys.length > 0) {
                              try {
                                const uniqueKeys = [...new Set(translationKeys)];
                                console.log('[DDT][Wizard][heuristicMatch] Loading translations for', uniqueKeys.length, 'unique keys');
                                templateTranslations = await getTemplateTranslations(uniqueKeys);
                                console.log('[DDT][Wizard][heuristicMatch] Loaded translations', {
                                  requestedKeys: uniqueKeys.length,
                                  loadedKeys: Object.keys(templateTranslations).length,
                                  loadedKeysList: Object.keys(templateTranslations),
                                  sampleTranslations: Object.entries(templateTranslations).slice(0, 3).map(([k, v]) => ({
                                    key: k,
                                    hasEn: !!v.en,
                                    hasIt: !!v.it,
                                    hasPt: !!v.pt,
                                    enValue: v.en ? v.en.substring(0, 30) : undefined,
                                    itValue: v.it ? v.it.substring(0, 30) : undefined,
                                    ptValue: v.pt ? v.pt.substring(0, 30) : undefined
                                  }))
                                });
                              } catch (err) {
                                console.error('[DDT][Wizard][heuristicMatch] Failed to load template translations:', err);
                              }
                            }

                            // Set schema for assembly
                            setSchemaRootLabel(root);
                            setSchemaMains(mains0);

                            // ✅ CRITICAL: Verify sub-data stepPrompts are present BEFORE assembly
                            console.log('🔴 [CRITICAL] BEFORE ASSEMBLY - SUB-DATA STEPPROMPTS', {
                              mains: mains0.map((m: any) => ({
                                label: m.label,
                                subData: (m.subData || []).map((s: any) => ({
                                  label: s.label,
                                  HAS_STEPPROMPTS: !!(s as any).stepPrompts,
                                  stepPrompts: (s as any).stepPrompts
                                }))
                              }))
                            });

                            const emptyStore = buildArtifactStore([]);
                            const finalDDT = assembleFinalDDT(
                              root || 'Data',
                              mains0,
                              emptyStore,
                              { escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 } }
                            );

                            // Map template keys to runtime keys and copy translations
                            if (finalDDT.translations && Object.keys(templateTranslations).length > 0) {
                              if (!finalDDT.translations.en) finalDDT.translations.en = {};
                              if (!(finalDDT.translations as any).it) (finalDDT.translations as any).it = {};
                              if (!(finalDDT.translations as any).pt) (finalDDT.translations as any).pt = {};

                              // Map template keys to runtime keys by iterating through the DDT structure
                              const templateKeyToRuntimeKey = new Map<string, string>();

                              // Extract mapping from mainData structure
                              finalDDT.mainData?.forEach((main: any) => {
                                // Map messages (start, noMatch, etc.)
                                if (main.messages) {
                                  Object.entries(main.messages).forEach(([stepKey, msg]: [string, any]) => {
                                    const runtimeKey = msg.textKey;
                                    const templateKey = (msg as any).__templateKey;
                                    console.log('[DDT][Wizard][heuristicMatch] Mapping message', {
                                      stepKey,
                                      runtimeKey,
                                      templateKey,
                                      hasTemplateKey: !!templateKey
                                    });
                                    if (templateKey && runtimeKey) {
                                      templateKeyToRuntimeKey.set(templateKey, runtimeKey);
                                    }
                                  });
                                }

                                // Map escalations
                                if (main.steps) {
                                  Object.entries(main.steps).forEach(([stepKey, step]: [string, any]) => {
                                    if (step.escalations) {
                                      step.escalations.forEach((esc: any, escIdx: number) => {
                                        const escActionKey = esc.actions?.[0]?.parameters?.[0]?.value;
                                        const templateKey = (esc as any).__templateKey;
                                        console.log('[DDT][Wizard][heuristicMatch] Mapping escalation', {
                                          stepKey,
                                          escIdx,
                                          escActionKey,
                                          templateKey,
                                          hasTemplateKey: !!templateKey
                                        });
                                        if (templateKey && escActionKey) {
                                          templateKeyToRuntimeKey.set(templateKey, escActionKey);
                                        }
                                      });
                                    }
                                  });
                                }

                                // Also check subData recursively
                                if (main.subData && Array.isArray(main.subData)) {
                                  console.log('[DDT][Wizard][heuristicMatch] 🔍 MAPPING SUB DATA FOR MAIN', {
                                    mainLabel: main.label,
                                    subDataCount: main.subData.length
                                  });

                                  const processSubData = (subDataArray: any[], level: number = 0) => {
                                    subDataArray.forEach((sub: any, subIdx: number) => {
                                      console.log('[DDT][Wizard][heuristicMatch] 🔍 MAPPING SUB DATA ITEM', {
                                        mainLabel: main.label,
                                        subIndex: subIdx,
                                        subLabel: sub.label,
                                        level,
                                        hasMessages: !!sub.messages,
                                        hasSteps: !!sub.steps,
                                        messagesCount: sub.messages ? Object.keys(sub.messages).length : 0,
                                        stepsCount: sub.steps ? Object.keys(sub.steps).length : 0
                                      });

                                      if (sub.messages) {
                                        Object.entries(sub.messages).forEach(([stepKey, msg]: [string, any]) => {
                                          const runtimeKey = msg.textKey;
                                          const templateKey = (msg as any).__templateKey;
                                          console.log('[DDT][Wizard][heuristicMatch] 🔍 MAPPING SUB DATA MESSAGE', {
                                            mainLabel: main.label,
                                            subLabel: sub.label,
                                            stepKey,
                                            runtimeKey,
                                            templateKey,
                                            hasTemplateKey: !!templateKey
                                          });
                                          if (templateKey && runtimeKey) {
                                            templateKeyToRuntimeKey.set(templateKey, runtimeKey);
                                            console.log('[DDT][Wizard][heuristicMatch] ✅ MAPPED SUB DATA MESSAGE', {
                                              templateKey,
                                              runtimeKey,
                                              mainLabel: main.label,
                                              subLabel: sub.label,
                                              stepKey
                                            });
                                          } else {
                                            console.warn('[DDT][Wizard][heuristicMatch] ⚠️ SUB DATA MESSAGE MISSING TEMPLATE KEY', {
                                              mainLabel: main.label,
                                              subLabel: sub.label,
                                              stepKey,
                                              runtimeKey,
                                              hasTemplateKey: !!templateKey
                                            });
                                          }
                                        });
                                      }
                                      if (sub.steps) {
                                        Object.entries(sub.steps).forEach(([stepKey, step]: [string, any]) => {
                                          if (step.escalations) {
                                            step.escalations.forEach((esc: any, escIdx: number) => {
                                              const escActionKey = esc.actions?.[0]?.parameters?.[0]?.value;
                                              const templateKey = (esc as any).__templateKey;
                                              console.log('[DDT][Wizard][heuristicMatch] 🔍 MAPPING SUB DATA ESCALATION', {
                                                mainLabel: main.label,
                                                subLabel: sub.label,
                                                stepKey,
                                                escIdx,
                                                escActionKey,
                                                templateKey,
                                                hasTemplateKey: !!templateKey
                                              });
                                              if (templateKey && escActionKey) {
                                                templateKeyToRuntimeKey.set(templateKey, escActionKey);
                                                console.log('[DDT][Wizard][heuristicMatch] ✅ MAPPED SUB DATA ESCALATION', {
                                                  templateKey,
                                                  runtimeKey: escActionKey,
                                                  mainLabel: main.label,
                                                  subLabel: sub.label,
                                                  stepKey,
                                                  escIdx
                                                });
                                              } else {
                                                console.warn('[DDT][Wizard][heuristicMatch] ⚠️ SUB DATA ESCALATION MISSING TEMPLATE KEY', {
                                                  mainLabel: main.label,
                                                  subLabel: sub.label,
                                                  stepKey,
                                                  escIdx,
                                                  escActionKey,
                                                  hasTemplateKey: !!templateKey
                                                });
                                              }
                                            });
                                          }
                                        });
                                      }
                                      if (sub.subData && Array.isArray(sub.subData)) {
                                        processSubData(sub.subData, level + 1);
                                      }
                                    });
                                  };
                                  processSubData(main.subData, 0);
                                } else {
                                  console.log('[DDT][Wizard][heuristicMatch] ⚠️ MAIN DATA HAS NO SUB DATA', {
                                    mainLabel: main.label,
                                    hasSubData: !!(main.subData && Array.isArray(main.subData)),
                                    subDataCount: main.subData ? (Array.isArray(main.subData) ? main.subData.length : 0) : 0
                                  });
                                }
                              });

                              // Copy translations from template keys to runtime keys
                              let mergedCount = 0;
                              const mappingDetails: Array<{ templateKey: string; runtimeKey: string; hasPt: boolean; ptValue: string }> = [];
                              console.log('[DDT][Wizard][heuristicMatch] 🔍 START COPYING TRANSLATIONS', {
                                totalMappings: templateKeyToRuntimeKey.size,
                                templateTranslationsKeys: Object.keys(templateTranslations),
                                finalDDTTranslationsStructure: {
                                  hasEn: !!finalDDT.translations.en,
                                  hasIt: !!(finalDDT.translations as any).it,
                                  hasPt: !!(finalDDT.translations as any).pt
                                }
                              });

                              templateKeyToRuntimeKey.forEach((runtimeKey, templateKey) => {
                                const templateTranslation = templateTranslations[templateKey];
                                console.log('[DDT][Wizard][heuristicMatch] 🔍 COPYING TRANSLATION', {
                                  templateKey,
                                  runtimeKey,
                                  hasTemplateTranslation: !!templateTranslation,
                                  templateTranslationStructure: templateTranslation ? {
                                    hasEn: !!templateTranslation.en,
                                    hasIt: !!templateTranslation.it,
                                    hasPt: !!templateTranslation.pt,
                                    enValue: templateTranslation.en?.substring(0, 30),
                                    itValue: templateTranslation.it?.substring(0, 30),
                                    ptValue: templateTranslation.pt?.substring(0, 30)
                                  } : null
                                });

                                if (templateTranslation) {
                                  if (templateTranslation.en) {
                                    finalDDT.translations.en[runtimeKey] = templateTranslation.en;
                                    mergedCount++;
                                    console.log('[DDT][Wizard][heuristicMatch] ✅ COPIED EN', {
                                      runtimeKey,
                                      value: templateTranslation.en.substring(0, 30),
                                      nowInEn: !!finalDDT.translations.en[runtimeKey]
                                    });
                                  }
                                  if (templateTranslation.it) {
                                    (finalDDT.translations as any).it[runtimeKey] = templateTranslation.it;
                                    mergedCount++;
                                    console.log('[DDT][Wizard][heuristicMatch] ✅ COPIED IT', {
                                      runtimeKey,
                                      value: templateTranslation.it.substring(0, 30),
                                      nowInIt: !!(finalDDT.translations as any).it[runtimeKey]
                                    });
                                  }
                                  if (templateTranslation.pt) {
                                    (finalDDT.translations as any).pt[runtimeKey] = templateTranslation.pt;
                                    mergedCount++;
                                    console.log('[DDT][Wizard][heuristicMatch] ✅ COPIED PT', {
                                      runtimeKey,
                                      value: templateTranslation.pt.substring(0, 30),
                                      nowInPt: !!(finalDDT.translations as any).pt[runtimeKey],
                                      verifiedValue: (finalDDT.translations as any).pt[runtimeKey]?.substring(0, 30)
                                    });
                                    mappingDetails.push({
                                      templateKey,
                                      runtimeKey,
                                      hasPt: true,
                                      ptValue: templateTranslation.pt.substring(0, 50)
                                    });
                                  } else {
                                    console.warn('[DDT][Wizard][heuristicMatch] ⚠️ NO PT TRANSLATION', {
                                      templateKey,
                                      runtimeKey,
                                      hasEn: !!templateTranslation.en,
                                      hasIt: !!templateTranslation.it
                                    });
                                    mappingDetails.push({
                                      templateKey,
                                      runtimeKey,
                                      hasPt: false,
                                      ptValue: ''
                                    });
                                  }
                                } else {
                                  console.warn('[DDT][Wizard][heuristicMatch] ⚠️ NO TEMPLATE TRANSLATION FOUND', {
                                    templateKey,
                                    runtimeKey,
                                    availableTemplateKeys: Object.keys(templateTranslations)
                                  });
                                }
                              });

                              console.log('[DDT][Wizard][heuristicMatch] Translation mapping details', {
                                totalMappings: templateKeyToRuntimeKey.size,
                                mappingsWithPt: mappingDetails.filter(m => m.hasPt).length,
                                sampleMappings: mappingDetails.slice(0, 5),
                                allMappings: mappingDetails.map(m => ({
                                  templateKey: m.templateKey,
                                  runtimeKey: m.runtimeKey,
                                  hasPt: m.hasPt,
                                  ptValue: m.ptValue
                                }))
                              });

                              // 🔍 DEBUG: Verifica che le traduzioni siano state copiate correttamente
                              const sampleRuntimeKey = mappingDetails[0]?.runtimeKey;
                              if (sampleRuntimeKey) {
                                console.log('[DDT][Wizard][heuristicMatch] Sample translation check', {
                                  runtimeKey: sampleRuntimeKey,
                                  hasInEn: !!finalDDT.translations.en[sampleRuntimeKey],
                                  hasInIt: !!(finalDDT.translations as any).it[sampleRuntimeKey],
                                  hasInPt: !!(finalDDT.translations as any).pt[sampleRuntimeKey],
                                  enValue: finalDDT.translations.en[sampleRuntimeKey]?.substring(0, 50),
                                  itValue: (finalDDT.translations as any).it[sampleRuntimeKey]?.substring(0, 50),
                                  ptValue: (finalDDT.translations as any).pt[sampleRuntimeKey]?.substring(0, 50)
                                });
                              }

                              // Clean up __templateKey metadata after copying translations
                              finalDDT.mainData?.forEach((main: any) => {
                                if (main.messages) {
                                  Object.values(main.messages).forEach((msg: any) => {
                                    delete (msg as any).__templateKey;
                                  });
                                }
                                if (main.steps) {
                                  Object.values(main.steps).forEach((step: any) => {
                                    if (step.escalations) {
                                      step.escalations.forEach((esc: any) => {
                                        delete (esc as any).__templateKey;
                                      });
                                    }
                                  });
                                }
                                // Clean up subData recursively
                                if (main.subData && Array.isArray(main.subData)) {
                                  const cleanSubData = (subDataArray: any[]) => {
                                    subDataArray.forEach((sub: any) => {
                                      if (sub.messages) {
                                        Object.values(sub.messages).forEach((msg: any) => {
                                          delete (msg as any).__templateKey;
                                        });
                                      }
                                      if (sub.steps) {
                                        Object.values(sub.steps).forEach((step: any) => {
                                          if (step.escalations) {
                                            step.escalations.forEach((esc: any) => {
                                              delete (esc as any).__templateKey;
                                            });
                                          }
                                        });
                                      }
                                      if (sub.subData && Array.isArray(sub.subData)) {
                                        cleanSubData(sub.subData);
                                      }
                                    });
                                  };
                                  cleanSubData(main.subData);
                                }
                              });

                              console.log('[DDT][Wizard][heuristicMatch] Copied template translations to runtime keys', {
                                templateKeysCount: templateKeyToRuntimeKey.size,
                                mergedEntries: mergedCount,
                                enKeys: Object.keys(finalDDT.translations.en).filter(k => k.startsWith('runtime.')).length,
                                itKeys: Object.keys((finalDDT.translations as any).it).filter(k => k.startsWith('runtime.')).length,
                                ptKeys: Object.keys((finalDDT.translations as any).pt).filter(k => k.startsWith('runtime.')).length,
                                samplePtKeys: Object.keys((finalDDT.translations as any).pt).filter(k => k.startsWith('runtime.')).slice(0, 5),
                                samplePtValues: Object.entries((finalDDT.translations as any).pt)
                                  .filter(([k]) => k.startsWith('runtime.'))
                                  .slice(0, 3)
                                  .map(([k, v]) => ({ key: k, value: String(v).substring(0, 30) }))
                              });
                            } else {
                              console.warn('[DDT][Wizard][heuristicMatch] No template translations to merge', {
                                hasFinalDDTTranslations: !!finalDDT.translations,
                                templateTranslationsCount: Object.keys(templateTranslations).length
                              });
                            }

                            console.log('[DDT][Wizard][heuristicMatch] Assembled DDT with stepPrompts:', {
                              ddtId: finalDDT.id,
                              mainsCount: finalDDT.mainData?.length || 0,
                              hasTranslations: !!finalDDT.translations,
                              templateTranslationsCount: Object.keys(templateTranslations).length,
                              translationsStructure: finalDDT.translations ? {
                                hasEn: !!finalDDT.translations.en,
                                hasIt: !!(finalDDT.translations as any).it,
                                hasPt: !!(finalDDT.translations as any).pt,
                                enKeys: finalDDT.translations.en ? Object.keys(finalDDT.translations.en).length : 0,
                                itKeys: (finalDDT.translations as any).it ? Object.keys((finalDDT.translations as any).it).length : 0,
                                ptKeys: (finalDDT.translations as any).pt ? Object.keys((finalDDT.translations as any).pt).length : 0
                              } : null
                            });

                            // Verify DDT structure before passing to Response Editor
                            if (!finalDDT.mainData || finalDDT.mainData.length === 0) {
                              console.error('[DDT][Wizard][heuristicMatch] ERROR: DDT has no mainData!', finalDDT);
                              error('DDT_WIZARD', 'DDT has no mainData after assembly', new Error('DDT has no mainData'));
                              return;
                            }

                            if (!finalDDT.mainData[0].steps || Object.keys(finalDDT.mainData[0].steps).length === 0) {
                              console.error('[DDT][Wizard][heuristicMatch] ERROR: DDT mainData has no steps!', {
                                ddtId: finalDDT.id,
                                mainData: finalDDT.mainData[0]
                              });
                              error('DDT_WIZARD', 'DDT mainData has no steps after assembly', new Error('DDT mainData has no steps'));
                              return;
                            }

                            console.log('[DDT][Wizard][heuristicMatch] ✅ DDT structure verified, calling handleClose');

                            // Call onComplete to open Response Editor directly
                            handleClose(finalDDT, finalDDT.translations || {});
                          } catch (err) {
                            console.error('[DDT][Wizard][heuristicMatch] Failed to assemble DDT:', err);
                            error('DDT_WIZARD', 'Failed to assemble DDT with stepPrompts', err);
                          }
                        } else {
                          // No stepPrompts: enrich constraints and show structure step
                          console.log('[DDT][Wizard][heuristicMatch] No stepPrompts, enriching constraints and showing structure');

                          // Enrich constraints
                          console.log('[DDT][Wizard][heuristicMatch] Starting enrichConstraints', { root, mainsCount: mains0.length });
                          const enrichedRes = await enrichConstraintsFor(root, mains0);
                          console.log('[DDT][Wizard][heuristicMatch] Enrichment done', {
                            hasLabel: !!(enrichedRes as any)?.label,
                            hasMains: !!(enrichedRes as any)?.mains,
                            mainsCount: (enrichedRes as any)?.mains?.length || 0
                          });

                          const finalRoot = (enrichedRes && (enrichedRes as any).label) ? (enrichedRes as any).label : root;
                          let finalMains: any[] = (enrichedRes && (enrichedRes as any).mains) ? (enrichedRes as any).mains as any[] : mains0 as any[];

                          // Fallback: infer subData from text if missing
                          try {
                            const inferred = inferSubDataFromText(userDesc);
                            console.log('[DDT][Wizard][heuristicMatch] Inferred subData', { inferredCount: inferred.length, inferred });
                            if (Array.isArray(finalMains) && finalMains.length > 0 && (!finalMains[0].subData || finalMains[0].subData.length === 0) && inferred.length > 0) {
                              finalMains = [{ ...finalMains[0], subData: inferred }];
                              console.log('[DDT][Wizard][heuristicMatch] Applied inferred subData', { finalMainsCount: finalMains.length });
                            }
                          } catch (err) {
                            console.log('[DDT][Wizard][heuristicMatch] Inference failed', { error: err });
                          }

                          setSchemaRootLabel(finalRoot);
                          setSchemaMains(finalMains);
                          setStep('structure'); // Show structure step
                          console.log('[DDT][Wizard][heuristicMatch] step → structure (confirmed)', {
                            root: finalRoot,
                            mainsCount: finalMains.length
                          });
                          try { dlog('[DDT][UI][AUTO] step → structure (heuristic confirmed)', { root: finalRoot, mains: finalMains.length }); } catch { }
                        }
                      }}
                      style={{
                        background: '#22c55e',
                        color: '#0b1220',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 20px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => {
                        console.log('[DDT][Wizard][heuristicMatch] User rejected, showing input alongside');
                        setShowInputAlongsideConfirm(true); // Show input alongside, DON'T hide confirmation
                        // DON'T remove pendingHeuristicMatch, DON'T hide right panel
                      }}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 20px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Show MainDataCollection (same as structure step) */}
                <div tabIndex={0} style={{ outline: 'none' }}>
                  <MainDataCollection
                    rootLabel={displayRoot}
                    mains={displayMains}
                    onChangeMains={setSchemaMains}
                    onAddMain={handleAddMain}
                    progressByPath={{ ...taskProgress, __root__: rootProgress }}
                    fieldProcessingStates={fieldProcessingStates}
                    selectedIdx={selectedIdx}
                    onSelect={setSelectedIdx}
                    autoEditIndex={autoEditIndex}
                    onChangeEvent={handleChangeEvent}
                    onAutoMap={autoMapFieldStructure}
                    onRetryField={handleRetryField}
                    onCreateManually={handleCreateManually}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Right panel for other steps (NOT heuristic-confirm) */}
      {rightHasContent && step !== 'heuristic-confirm' && (
        <div style={{ overflow: 'auto', borderLeft: '1px solid #1f2340', padding: 12 }}>
          {step === 'loading' && <WizardLoadingStep />}

          {step === 'error' && (
            <WizardErrorStep
              errorMsg={errorMsg}
              onRetry={handleDetectType}
              onSupport={() => setStep('support')}
              onCancel={handleClose}
            />
          )}

          {(step === 'structure' || step === 'pipeline') && (
            <div style={{ padding: 4 }}>
              <div tabIndex={0} style={{ outline: 'none' }}>
                <MainDataCollection
                  rootLabel={schemaRootLabel || 'Data'}
                  mains={schemaMains}
                  onChangeMains={setSchemaMains}
                  onAddMain={handleAddMain}
                  progressByPath={{ ...taskProgress, __root__: rootProgress }}
                  fieldProcessingStates={fieldProcessingStates}
                  selectedIdx={selectedIdx}
                  onSelect={setSelectedIdx}
                  autoEditIndex={autoEditIndex}
                  onChangeEvent={handleChangeEvent}
                  onAutoMap={autoMapFieldStructure}
                  onRetryField={handleRetryField}
                  onCreateManually={handleCreateManually}
                />
              </div>
              {step === 'structure' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  {/* Save buttons - only show for composite DDTs */}
                  {isCompositeDDT && (
                    <>
                      <button
                        onClick={handleSaveToFactory}
                        disabled={saving !== null}
                        style={{
                          background: saving === 'factory' ? '#64748b' : '#3b82f6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontWeight: 600,
                          cursor: saving !== null ? 'not-allowed' : 'pointer',
                          opacity: saving !== null ? 0.6 : 1
                        }}
                      >
                        {saving === 'factory' ? 'Saving...' : 'Save in Factory'}
                      </button>
                      <button
                        onClick={handleSaveToProject}
                        disabled={saving !== null || !currentProjectId}
                        style={{
                          background: saving === 'project' ? '#64748b' : '#8b5cf6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontWeight: 600,
                          cursor: (saving !== null || !currentProjectId) ? 'not-allowed' : 'pointer',
                          opacity: (saving !== null || !currentProjectId) ? 0.6 : 1
                        }}
                      >
                        {saving === 'project' ? 'Saving...' : 'Save in Project'}
                      </button>
                    </>
                  )}
                  <button onClick={handleClose} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
                  {/* Only show "Build Messages" if no stepPrompts are present (new DDT structure) */}
                  {!schemaMains.some((m: any) => m.stepPrompts && Object.keys(m.stepPrompts).length > 0) && (
                    <button
                      onClick={() => {
                        try { dlog('[DDT][UI] step → pipeline'); } catch { }
                        // Avvia pipeline generativa mantenendo visibile la struttura (progress in-place)
                        setShowRight(true);
                        // reset progress state to avoid stale 100%
                        setTaskProgress({});
                        setRootProgress(0);
                        setPartialResults({}); // Reset parallel processing results
                        // Apri il primo main data
                        setSelectedIdx(0);
                        setStep('pipeline');
                      }}
                      style={{ background: '#22c55e', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Build Messages
                    </button>
                  )}
                  {/* If stepPrompts are present, automatically proceed to Response Editor when user clicks any action */}
                  {schemaMains.some((m: any) => m.stepPrompts && Object.keys(m.stepPrompts).length > 0) && (
                    <button
                      onClick={async () => {
                        try {
                          dlog('[DDT][UI] step → complete with stepPrompts');
                        } catch { }

                        // Assemble final DDT with stepPrompts
                        try {
                          // Extract all translation keys from stepPrompts
                          const translationKeys: string[] = [];
                          schemaMains.forEach((m: any) => {
                            if (m.stepPrompts && typeof m.stepPrompts === 'object') {
                              Object.values(m.stepPrompts).forEach((stepPrompt: any) => {
                                if (stepPrompt && Array.isArray(stepPrompt.keys)) {
                                  translationKeys.push(...stepPrompt.keys);
                                }
                              });
                            }
                          });

                          console.log('[DDT][Wizard][stepPrompts] Extracted translation keys:', translationKeys);

                          // Load translations from database
                          let templateTranslations: Record<string, { en: string; it: string; pt: string }> = {};
                          if (translationKeys.length > 0) {
                            try {
                              templateTranslations = await getTemplateTranslations(translationKeys);
                              console.log('[DDT][Wizard][stepPrompts] Loaded', Object.keys(templateTranslations).length, 'translations');
                            } catch (err) {
                              console.error('[DDT][Wizard][stepPrompts] Failed to load template translations:', err);
                            }
                          }

                          const emptyStore = buildArtifactStore([]);
                          const finalDDT = assembleFinalDDT(
                            schemaRootLabel || 'Data',
                            schemaMains,
                            emptyStore,
                            { escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 } }
                          );

                          // Merge template translations into final DDT translations
                          if (finalDDT.translations && Object.keys(templateTranslations).length > 0) {
                            if (!finalDDT.translations.en) finalDDT.translations.en = {};
                            if (!(finalDDT.translations as any).it) (finalDDT.translations as any).it = {};
                            if (!(finalDDT.translations as any).pt) (finalDDT.translations as any).pt = {};

                            Object.entries(templateTranslations).forEach(([key, value]) => {
                              if (value.en) finalDDT.translations.en[key] = value.en;
                              if (value.it) (finalDDT.translations as any).it[key] = value.it;
                              if (value.pt) (finalDDT.translations as any).pt[key] = value.pt;
                            });
                          }

                          console.log('[DDT][Wizard][stepPrompts] Assembled DDT with stepPrompts:', {
                            ddtId: finalDDT.id,
                            mainsCount: finalDDT.mainData?.length || 0,
                            hasTranslations: !!finalDDT.translations,
                            templateTranslationsCount: Object.keys(templateTranslations).length,
                            translationsStructure: finalDDT.translations ? {
                              hasEn: !!finalDDT.translations.en,
                              hasIt: !!(finalDDT.translations as any).it,
                              hasPt: !!(finalDDT.translations as any).pt,
                              enKeys: finalDDT.translations.en ? Object.keys(finalDDT.translations.en).length : 0,
                              itKeys: (finalDDT.translations as any).it ? Object.keys((finalDDT.translations as any).it).length : 0,
                              ptKeys: (finalDDT.translations as any).pt ? Object.keys((finalDDT.translations as any).pt).length : 0
                            } : null,
                            firstMainSteps: finalDDT.mainData?.[0]?.steps ? Object.keys(finalDDT.mainData[0].steps) : [],
                            firstMainMessages: finalDDT.mainData?.[0]?.messages ? Object.keys(finalDDT.mainData[0].messages) : []
                          });

                          // Verify DDT structure before passing to Response Editor
                          if (!finalDDT.mainData || finalDDT.mainData.length === 0) {
                            console.error('[DDT][Wizard][stepPrompts] ERROR: DDT has no mainData!', finalDDT);
                            error('DDT_WIZARD', 'DDT has no mainData after assembly', new Error('DDT has no mainData'));
                            return;
                          }

                          if (!finalDDT.mainData[0].steps || Object.keys(finalDDT.mainData[0].steps).length === 0) {
                            console.error('[DDT][Wizard][stepPrompts] ERROR: DDT mainData has no steps!', {
                              ddtId: finalDDT.id,
                              mainData: finalDDT.mainData[0]
                            });
                            error('DDT_WIZARD', 'DDT mainData has no steps after assembly', new Error('DDT mainData has no steps'));
                            return;
                          }

                          console.log('[DDT][Wizard][stepPrompts] ✅ DDT structure verified, calling handleClose');

                          // Call onComplete to open Response Editor
                          handleClose(finalDDT, finalDDT.translations || {});
                        } catch (err) {
                          console.error('[DDT][Wizard][stepPrompts] Failed to assemble DDT:', err);
                          error('DDT_WIZARD', 'Failed to assemble DDT with stepPrompts', err);
                        }
                      }}
                      style={{ background: '#22c55e', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'pipeline' && (
            <div style={{ position: 'relative' }}>
              {schemaMains.map((mainItem, mainIdx) => {
                const mainDataNode = {
                  name: (mainItem as any)?.label || 'Data',
                  label: (mainItem as any)?.label || 'Data',  // ← ADD: label for DDT assembly
                  type: (mainItem as any)?.type,
                  icon: (mainItem as any)?.icon,              // ← ADD: icon for proper display
                  subData: ((mainItem as any)?.subData || []) as any[],
                };

                return (
                  <div
                    key={`pipeline-${mainIdx}-${mainItem.label}`}
                    style={{
                      display: mainIdx === selectedIdx ? 'block' : 'none'
                    }}
                  >
                    <WizardPipelineStep
                      headless={pipelineHeadless}
                      dataNode={mainDataNode}
                      detectTypeIcon={(mainItem as any)?.icon || detectTypeIcon}
                      onCancel={() => setStep('structure')}
                      skipDetectType
                      confirmedLabel={mainDataNode?.name || 'Data'}
                      setFieldProcessingStates={setFieldProcessingStates}
                      progressByPath={taskProgress}
                      onProgress={(m) => {
                        const mainLabel = mainItem.label;
                        // Update individual main progress
                        const mainProgress = typeof (m as any)?.[mainLabel] === 'number' ? (m as any)[mainLabel] : 0;

                        setTaskProgress((prev) => {
                          const updated = { ...(prev || {}), ...(m || {}) };
                          // Calculate overall root progress (average of all mains)
                          const allProgress = schemaMains.map(m => updated[m.label] || 0);
                          const avgProgress = allProgress.reduce((sum, p) => sum + p, 0) / schemaMains.length;
                          updated.__root__ = avgProgress;
                          return updated;
                        });

                        setRootProgress((prev) => {
                          // 🎯 CORRETTO: Usa TaskCounter per calcolare task completati/totali
                          const mainDataArray = schemaMains.map(m => ({
                            label: m.label,
                            subData: (m.subData || []).map(s => ({ label: s.label }))
                          }));

                          const progressMap = taskCounter.calculateRecursiveProgress(mainDataArray);
                          return progressMap.__root__ || 0;
                        });
                      }}
                      onComplete={(partialDDT) => {
                        // Accumulate partial result
                        setPartialResults(prev => {
                          const updated = { ...prev, [mainIdx]: partialDDT };

                          // Check if all mains completed
                          const completedCount = Object.keys(updated).length;

                          if (completedCount === schemaMains.length) {
                            // All mains completed - assemble final DDT

                            try {
                              // Merge all mainData from partial results
                              const allMains = schemaMains.map((schemaMain, idx) => {
                                const partial = updated[idx];
                                if (!partial || !partial.mainData || partial.mainData.length === 0) {
                                  console.warn(`[DDT][Wizard][parallel] Missing mainData for idx ${idx}:`, schemaMain.label);
                                  return null;
                                }
                                return partial.mainData[0]; // Each partial has 1 main
                              }).filter(Boolean);

                              // Merge translations
                              const mergedTranslations: any = {};
                              Object.values(updated).forEach((partial: any) => {
                                if (partial?.translations) {
                                  Object.assign(mergedTranslations, partial.translations);
                                }
                              });

                              const finalDDT = {
                                id: schemaRootLabel || 'Data',
                                label: schemaRootLabel || 'Data',
                                mainData: allMains,
                                translations: mergedTranslations,
                                _fromWizard: true  // Flag to identify wizard-generated DDTs
                              };

                              // Preserve _userLabel and _sourceAct
                              if ((dataNode as any)?._userLabel && !(finalDDT as any)._userLabel) {
                                (finalDDT as any)._userLabel = (dataNode as any)._userLabel;
                              }
                              if ((dataNode as any)?._sourceAct) {
                                (finalDDT as any)._sourceAct = (dataNode as any)._sourceAct;
                              }

                              // Store in ref instead of calling handleClose directly
                              pendingCloseRef.current = {
                                ddt: finalDDT,
                                translations: finalDDT.translations || {}
                              };
                            } catch (err) {
                              console.error('[DDT][Wizard][parallel] Failed to assemble final DDT:', err);
                            }
                          }

                          return updated;
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Contenuto “normale” del pannello destro (solo quando non in pipeline) */}
          {(() => { try { dlog('[DDT][UI] render TogglePanel?', { render: renderTogglePanel }); } catch { }; return null; })()}
          {renderTogglePanel && <V2TogglePanel />}
          {/* CTA moved next to Cancel above */}
        </div>
      )}
    </div>
  );
};

export default DDTWizard;