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
import { useProjectTranslations } from '../../../context/ProjectTranslationsContext';
import { getTemplateTranslations } from '../../../services/ProjectDataService';
import { DialogueTemplateService } from '../../../services/DialogueTemplateService';
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

  // ✅ Get global translations context
  const { addTranslations: addTranslationsToGlobal } = useProjectTranslations();

  const [step, setStep] = useState<string>(() => {
    if (initialDDT?._inferenceResult?.ai?.schema && initialDDT.mainData?.length > 0) {
      return 'heuristic-confirm';
    }
    return startOnStructure ? 'structure' : 'input';
  });
  const [saving, setSaving] = useState<'factory' | 'project' | null>(null);

  const [pendingHeuristicMatch, setPendingHeuristicMatch] = useState<{
    schema: any;
    icon: string | null;
    mains0: SchemaNode[];
    root: string;
  } | null>(() => {
    if (initialDDT?._inferenceResult?.ai?.schema && initialDDT.mainData?.length > 0) {
      const mains = (initialDDT.mainData as any[]).map((m: any) => ({
        label: m.label,
        type: m.type,
        icon: m.icon,
        constraints: m.constraints || [],
        // ✅ Preserva stepPrompts per main
        stepPrompts: m.stepPrompts || null,
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: m.nlpContract || undefined,
        templateId: m.templateId || undefined,
        kind: m.kind || undefined,
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          label: s.label,
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          // ✅ Preserva stepPrompts per subData (solo start, noInput, noMatch)
          stepPrompts: s.stepPrompts || null,
          // ✅ CRITICO: Preserva nlpContract, templateId, kind anche per sub
          nlpContract: (s as any).nlpContract || undefined,
          templateId: (s as any).templateId || undefined,
          kind: (s as any).kind || undefined
        })) : []
      }));

      return {
        schema: initialDDT._inferenceResult.ai.schema,
        icon: initialDDT._inferenceResult.ai.icon || null,
        mains0: mains,
        root: initialDDT.label || 'Data'
      };
    }
    return null;
  });

  // Show input alongside confirmation when user clicks "No"
  const [showInputAlongsideConfirm, setShowInputAlongsideConfirm] = useState(false);

  // Schema editing state (from detect schema)
  const [schemaRootLabel, setSchemaRootLabel] = useState<string>(initialDDT?.label || '');
  const [schemaMains, setSchemaMains] = useState<SchemaNode[]>(() => {
    if (initialDDT?.mainData && Array.isArray(initialDDT.mainData) && initialDDT.mainData.length > 0) {
      const mains = (initialDDT.mainData as any[]).map((m: any) => ({
        label: m.label,
        type: m.type,
        icon: m.icon,
        constraints: m.constraints || [],
        // ✅ Preserva stepPrompts per main
        stepPrompts: m.stepPrompts || null,
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          label: s.label,
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          // ✅ Preserva stepPrompts per subData (solo start, noInput, noMatch)
          stepPrompts: s.stepPrompts || null
        })) : []
      })) as SchemaNode[];
      return mains;
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
  const [detectTypeIcon, setDetectTypeIcon] = useState<string | null>(() => initialDDT?._inferenceResult?.ai?.icon || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataNode] = useState<DataNode | null>(() => ({ name: initialDDT?.label || '' }));
  const [closed, setClosed] = useState(false);

  // Auto-detect function for real-time heuristic matching
  const handleAutoDetect = React.useCallback(async (text: string) => {
    const startTime = performance.now();
    console.log('[AUTO_DETECT][START] ════════════════════════════════════════');
    console.log('[AUTO_DETECT][START] 🎯 Auto-detect chiamato', {
      text,
      step,
      closed,
      textLength: text.trim().length,
      timestamp: new Date().toISOString()
    });

    if (step === 'pipeline' || closed || !text.trim() || text.trim().length < 3) {
      const reason = step === 'pipeline' ? 'pipeline' : closed ? 'closed' : !text.trim() ? 'empty' : 'too_short';
      console.log('[AUTO_DETECT][SKIP] ⏭️ Saltando auto-detect', { reason });
      console.log('[AUTO_DETECT][START] ════════════════════════════════════════');
      return;
    }

    console.log('[AUTO_DETECT][CALL] 🚀 Starting heuristic detection', {
      text,
      step,
      closed,
      textLength: text.trim().length,
      timestamp: new Date().toISOString()
    });

    try {
      // ✅ Use /step2-with-provider (Node.js) which now has heuristics integrated
      const urlPrimary = `/step2-with-provider`;
      const fetchStartTime = performance.now();
      console.log('[AUTO_DETECT][FETCH] 📡 Chiamando API', {
        url: urlPrimary,
        body: { userDesc: text.trim(), provider: selectedProvider.toLowerCase(), model: selectedModel },
        timestamp: new Date().toISOString()
      });

      const response = await fetch(urlPrimary, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDesc: text.trim(), provider: selectedProvider.toLowerCase(), model: selectedModel }),
      });

      const fetchElapsed = performance.now() - fetchStartTime;
      console.log('[AUTO_DETECT][RESPONSE] 📥 Risposta ricevuta', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        elapsedMs: Math.round(fetchElapsed),
        timestamp: new Date().toISOString()
      });

      if (!response.ok) {
        console.log('[AUTO_DETECT][ERROR] Response not OK', { status: response.status, statusText: response.statusText });
        // If heuristic fails, silently return (user can click "Invia" for AI)
        return;
      }

      const parseStartTime = performance.now();
      const result = await response.json();
      const parseElapsed = performance.now() - parseStartTime;
      const totalElapsed = performance.now() - startTime;
      console.log('[AUTO_DETECT][PARSE] 📋 Risultato parsato', {
        hasAi: !!result.ai,
        hasSchema: !!(result.ai || result).schema,
        resultKeys: Object.keys(result),
        parseElapsedMs: Math.round(parseElapsed),
        totalElapsedMs: Math.round(totalElapsed)
      });

      const ai = result.ai || result;
      console.log('[AUTO_DETECT][AI] 🤖 AI object analizzato', {
        hasSchema: !!ai.schema,
        hasMainData: !!(ai.schema && Array.isArray(ai.schema.mainData)),
        mainDataLength: ai.schema?.mainData?.length || 0,
        label: ai.schema?.label,
        icon: ai.icon,
        timestamp: new Date().toISOString()
      });

      // ✅ Check if heuristic match was found (has schema.mainData structure)
      if (ai.schema && Array.isArray(ai.schema.mainData) && ai.schema.mainData.length > 0) {
        console.log('[AUTO_DETECT][HEURISTIC_MATCH] ✅✅✅ MATCH TROVATO!', {
          label: ai.schema.label,
          mainsCount: ai.schema.mainData.length,
          mains: ai.schema.mainData.map((m: any) => ({ label: m.label, type: m.type, subDataCount: m.subData?.length || 0 })),
          totalElapsedMs: Math.round(totalElapsed),
          timestamp: new Date().toISOString()
        });

        // Instead of processing immediately, save the match and show confirmation
        const schema = ai.schema;
        const root = schema.label || 'Data';
        console.log('[AUTO_DETECT][PROCESS] Preparing match for confirmation', { root, mainsCount: schema.mainData.length });

        // ✅ DEBUG: Log schema.mainData per vedere se stepPrompts arrivano dall'API
        console.log('🔵 [AUTO_DETECT][MAINS0] Schema.mainData prima del map', {
          mainDataLength: schema.mainData?.length || 0,
          mainData: schema.mainData?.map((m: any) => ({
            label: m.label,
            hasStepPrompts: !!m.stepPrompts,
            stepPrompts: m.stepPrompts,
            allKeys: Object.keys(m)
          })) || [],
          schemaHasStepPrompts: !!schema.stepPrompts,
          schemaStepPrompts: schema.stepPrompts
        });

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
              stepPrompts: s.stepPrompts || undefined,
              // ✅ CRITICO: Preserva nlpContract, templateId, kind anche per sub
              nlpContract: (s as any).nlpContract || undefined,
              templateId: (s as any).templateId || undefined,
              kind: (s as any).kind || undefined
            };
          }) : [];

          const finalStepPrompts = m.stepPrompts || schema.stepPrompts || null;
          console.log('🔵 [AUTO_DETECT][MAINS0] Main', label, {
            hasMStepPrompts: !!m.stepPrompts,
            mStepPrompts: m.stepPrompts,
            hasSchemaStepPrompts: !!schema.stepPrompts,
            schemaStepPrompts: schema.stepPrompts,
            finalStepPrompts: finalStepPrompts
          });

          return {
            label,
            type,
            icon: m.icon,
            constraints: [],
            subData: processedSubData,
            // Include stepPrompts from template match if present
            stepPrompts: finalStepPrompts,
            // ✅ CRITICO: Preserva nlpContract, templateId, kind
            nlpContract: m.nlpContract || undefined,
            templateId: m.templateId || undefined,
            kind: m.kind || undefined
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
        const totalElapsed = performance.now() - startTime;
        console.log('[AUTO_DETECT][CONFIRM] ✅ Match salvato, mostrando conferma', {
          root,
          mainsCount: mains0.length,
          totalElapsedMs: Math.round(totalElapsed),
          timestamp: new Date().toISOString()
        });
        console.log('[AUTO_DETECT][START] ════════════════════════════════════════');
        return;
      }

      // No heuristic match found - user will need to click "Invia" for AI
      // totalElapsed già calcolato sopra
      console.log('[AUTO_DETECT][NO_MATCH] ❌ Nessun match euristico trovato', {
        hasSchema: !!ai.schema,
        hasMainData: !!(ai.schema && Array.isArray(ai.schema.mainData)),
        mainDataLength: ai.schema?.mainData?.length || 0,
        totalElapsedMs: Math.round(totalElapsed),
        timestamp: new Date().toISOString()
      });
      console.log('[AUTO_DETECT][START] ════════════════════════════════════════');
      debug('DDT_WIZARD', 'No heuristic match, AI will be called on submit');

    } catch (error) {
      // Silently fail - user can still use "Invia" button for AI
      const errorElapsed = performance.now() - startTime;
      console.error('[AUTO_DETECT][ERROR] ❌❌❌ ERRORE!', {
        error,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        totalElapsedMs: Math.round(errorElapsed),
        timestamp: new Date().toISOString()
      });
      console.log('[AUTO_DETECT][START] ════════════════════════════════════════');
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

  const [showRight, setShowRight] = useState<boolean>(() => {
    if (initialDDT?._inferenceResult?.ai?.schema && initialDDT.mainData?.length > 0) return true;
    return startOnStructure ? true : false;
  });

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

  // ✅ FIX: Memoizza mainDataNodes per evitare re-creazione ad ogni render
  const mainDataNodes = React.useMemo(() => {
    return schemaMains.map((mainItem) => ({
      name: (mainItem as any)?.label || 'Data',
      label: (mainItem as any)?.label || 'Data',
      type: (mainItem as any)?.type,
      icon: (mainItem as any)?.icon,
      subData: ((mainItem as any)?.subData || []) as any[],
    }));
  }, [schemaMains]);

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
            // ✅ CRITICO: Preserva nlpContract, templateId, kind
            nlpContract: m.nlpContract || undefined,
            templateId: m.templateId || undefined,
            kind: m.kind || undefined,
            subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
              label: s.label || s.name || 'Field',
              type: s.type,
              icon: s.icon,
              constraints: [], // TODO: Implement proper validation constraints later
              // ✅ CRITICO: Preserva nlpContract, templateId, kind anche per sub
              nlpContract: (s as any).nlpContract || undefined,
              templateId: (s as any).templateId || undefined,
              kind: (s as any).kind || undefined
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
    console.log('[DDT][Wizard][templateSelect] Full template structure:', {
      label: template.label,
      name: template.name,
      hasSubDataIds: !!template.subDataIds,
      subDataIdsLength: template.subDataIds?.length || 0,
      subDataIds: template.subDataIds,
      hasStepPrompts: !!template.stepPrompts,
      type: template.type,
      icon: template.icon,
      allKeys: Object.keys(template)
    });

    // ✅ NUOVA STRUTTURA: Costruisci istanza DDT dal template usando subDataIds
    // NOTA: Un template alla radice non sa se sarà usato come sottodato o come main,
    // quindi può avere tutti i 6 tipi di stepPrompts (start, noMatch, noInput, confirmation, notConfirmed, success).
    // Quando lo usiamo come sottodato, filtriamo e prendiamo solo start, noInput, noMatch.
    // Ignoriamo confirmation, notConfirmed, success anche se presenti nel template sottodato.
    const root = template.label || 'Data';
    const subDataIds = template.subDataIds || [];
    let mainData: any[] = [];

    if (subDataIds.length > 0) {
      // ✅ Template composito: crea UN SOLO mainData con subData[] popolato
      console.log('[DDT][Wizard][templateSelect] 📦 Template composito, creando istanze per sottodati', {
        subDataIds,
        count: subDataIds.length
      });

      // ✅ PRIMA: Costruisci array di subData instances
      // Per ogni ID in subDataIds, cerca il template corrispondente e crea una sotto-istanza
      const subDataInstances: any[] = [];
      const allTemplates = DialogueTemplateService.getAllTemplates();

      for (const subId of subDataIds) {
        // ✅ Cerca template per ID (può essere _id, id, name, o label)
        // Normalizza l'ID cercato (potrebbe essere ObjectId come stringa)
        const normalizedId = String(subId).trim();

        const subTemplate = allTemplates.find((t: any) => {
          // Confronta _id (potrebbe essere ObjectId o stringa)
          if (t._id) {
            const tId = String(t._id).trim();
            if (tId === normalizedId) return true;
            // Se entrambi sono ObjectId-like (24 caratteri hex), confronta senza case
            if (tId.length === 24 && normalizedId.length === 24 && /^[0-9a-fA-F]{24}$/i.test(tId) && /^[0-9a-fA-F]{24}$/i.test(normalizedId)) {
              if (tId.toLowerCase() === normalizedId.toLowerCase()) return true;
            }
          }
          // Confronta altri campi
          if (t.id && String(t.id).trim() === normalizedId) return true;
          if (t.name && String(t.name).trim() === normalizedId) return true;
          if (t.label && String(t.label).trim() === normalizedId) return true;
          return false;
        });

        if (subTemplate) {
          // ✅ Filtra stepPrompts: solo start, noInput, noMatch per sottodati
          // Ignora confirmation, notConfirmed, success anche se presenti nel template sottodato
          const filteredStepPrompts: any = {};
          if (subTemplate.stepPrompts) {
            if (subTemplate.stepPrompts.start) {
              filteredStepPrompts.start = subTemplate.stepPrompts.start;
            }
            if (subTemplate.stepPrompts.noInput) {
              filteredStepPrompts.noInput = subTemplate.stepPrompts.noInput;
            }
            if (subTemplate.stepPrompts.noMatch) {
              filteredStepPrompts.noMatch = subTemplate.stepPrompts.noMatch;
            }
            // ❌ Ignoriamo: confirmation, notConfirmed, success
          }

          // ✅ Usa la label del template trovato (non l'ID!)
          subDataInstances.push({
            label: subTemplate.label || subTemplate.name || 'Sub',
            type: subTemplate.type || subTemplate.name || 'generic',
            icon: subTemplate.icon || 'FileText',
            stepPrompts: Object.keys(filteredStepPrompts).length > 0 ? filteredStepPrompts : null,
            constraints: subTemplate.dataContracts || subTemplate.constraints || [],
            examples: subTemplate.examples || [],
            subData: [],
            // ✅ CRITICO: Preserva nlpContract, templateId, kind
            nlpContract: subTemplate.nlpContract || undefined,
            templateId: subTemplate.id || subTemplate._id || undefined,
            kind: subTemplate.name || subTemplate.type || undefined
          });
        } else {
          console.warn('[DDT][Wizard][templateSelect] ⚠️ Template sottodato non trovato per ID', { subId });
          // Fallback: crea placeholder senza stepPrompts
          subDataInstances.push({
            label: subId,
            type: 'generic',
            icon: 'FileText',
            stepPrompts: null,
            constraints: [],
            examples: [],
            subData: []
          });
        }
      }

      // ✅ POI: Crea UN SOLO mainData con subData[] popolato (non elementi separati!)
      // L'istanza principale copia TUTTI i stepPrompts dal template (tutti e 6 i tipi)
      const mainInstance = {
        label: template.label || template.name || 'Data',
        type: template.type,
        icon: template.icon || 'Calendar',
        stepPrompts: template.stepPrompts || null, // ✅ Tutti e 6 i tipi per main
        constraints: template.dataContracts || template.constraints || [],
        examples: template.examples || [],
        subData: subDataInstances, // ✅ Sottodati QUI dentro subData[], non in mainData[]
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: template.nlpContract || undefined,
        templateId: template.id || template._id || undefined,
        kind: template.name || template.type || undefined
      };
      mainData.push(mainInstance); // ✅ UN SOLO elemento in mainData
    } else {
      // ✅ Template semplice: crea istanza dal template root
      console.log('[DDT][Wizard][templateSelect] 📄 Template semplice, creando istanza root');
      mainData.push({
        label: template.label || template.name || 'Data',
        type: template.type,
        icon: template.icon || 'FileText',
        stepPrompts: template.stepPrompts || null,
        constraints: template.dataContracts || template.constraints || [],
        examples: template.examples || [],
        subData: [],
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: template.nlpContract || undefined,
        templateId: template.id || template._id || undefined,
        kind: template.name || template.type || undefined
      });
    }

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
        // ✅ Preserva subData con i loro stepPrompts filtrati
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          label: s.label || s.name || 'Field',
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          // ✅ Preserva stepPrompts filtrati (solo start, noInput, noMatch) per sottodati
          stepPrompts: s.stepPrompts || null,
          // ✅ CRITICO: Preserva nlpContract, templateId, kind anche per sub
          nlpContract: (s as any).nlpContract || undefined,
          templateId: (s as any).templateId || undefined,
          kind: (s as any).kind || undefined
        })) : [],
        // ✅ Include stepPrompts completi (tutti e 6 i tipi) per main
        stepPrompts: m.stepPrompts || template.stepPrompts || null,
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: m.nlpContract || undefined,
        templateId: m.templateId || undefined,
        kind: m.kind || undefined
      } as any;
    });

    // Create a fake schema for consistency
    const schema = {
      label: root,
      mainData: mains0
    };

    console.log('[DDT][Wizard][templateSelect] Processed mains0:', {
      count: mains0.length,
      mains: mains0.map(m => ({
        label: m.label,
        type: m.type,
        icon: m.icon,
        subDataCount: m.subData?.length || 0,
        hasStepPrompts: !!(m as any).stepPrompts,
        stepPromptsKeys: (m as any).stepPrompts ? Object.keys((m as any).stepPrompts) : [],
        subDataWithStepPrompts: (m.subData || []).map((s: any) => ({
          label: s.label,
          hasStepPrompts: !!s.stepPrompts,
          stepPromptsKeys: s.stepPrompts ? Object.keys(s.stepPrompts) : []
        }))
      }))
    });

    // Process as if it were a heuristic match
    setPendingHeuristicMatch({ schema, icon: template.icon || null, mains0, root });
    setShowInputAlongsideConfirm(false);
    setSchemaRootLabel(root);
    setSchemaMains(mains0);
    setDetectTypeIcon(template.icon || null);
    setShowRight(true);
    setStep('heuristic-confirm');
    console.log('[DDT][Wizard][templateSelect] Template processed, showing confirmation', {
      root,
      mainsCount: mains0.length,
      schema,
      hasPendingMatch: true
    });
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        // ✅ FIX: Adatta layout in base a cosa è visibile
        gridTemplateColumns: showInputAlongsideConfirm
          ? 'minmax(420px,520px) minmax(420px,520px) 1fr' // Input + Confirm + Right panel
          : (!pendingHeuristicMatch && rightHasContent)
            ? 'minmax(420px,520px) 1fr' // Solo Input + Right panel
            : (pendingHeuristicMatch && !rightHasContent)
              ? '1fr' // Solo Confirm (full width)
              : rightHasContent
                ? 'minmax(420px,520px) 1fr' // Confirm + Right panel
                : '1fr', // Solo Input (fallback)
        gap: 12,
        height: '100%',
      }}
    >
      {/* ✅ FIX: Monta WizardInputStep SOLO negli step corretti */}
      {/* Show WizardInputStep ONLY when:
          - step is 'input' (initial step)
          - OR (step is 'heuristic-confirm' AND showInputAlongsideConfirm is true - user clicked "No") */}
      {(step === 'input' || (step === 'heuristic-confirm' && showInputAlongsideConfirm)) && (
        <div style={{
          overflow: 'auto',
          padding: '0 8px'
        }}>
          <WizardInputStep
            userDesc={userDesc}
            setUserDesc={setUserDesc}
            onNext={handleDetectType}
            onCancel={handleClose}
            dataNode={stableDataNode || undefined}
            onAutoDetect={initialDDT?._inferenceResult ? undefined : handleAutoDetect}
            onTemplateSelect={handleTemplateSelect}
          />
        </div>
      )}

      {/* Confirmation panel - show if pendingHeuristicMatch exists */}
      {pendingHeuristicMatch && (
        <div style={{ overflow: 'auto', borderLeft: '1px solid #1f2340', padding: 12 }}>
          {step === 'heuristic-confirm' && pendingHeuristicMatch && (() => {
            const { schema, icon, mains0, root } = pendingHeuristicMatch;
            const displayMains = schemaMains.length > 0 ? schemaMains : mains0;
            const displayRoot = schemaRootLabel || root;

            // ✅ Estrai GUID dai stepPrompts per debug traduzioni
            const allGuidsFromMains: string[] = [];
            displayMains.forEach((m: any) => {
              if (m.stepPrompts) {
                Object.values(m.stepPrompts).forEach((guids: any) => {
                  if (Array.isArray(guids)) {
                    guids.forEach((guid: string) => {
                      if (typeof guid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                        allGuidsFromMains.push(guid);
                      }
                    });
                  }
                });
              }
              if (m.subData) {
                m.subData.forEach((s: any) => {
                  if (s.stepPrompts) {
                    Object.values(s.stepPrompts).forEach((guids: any) => {
                      if (Array.isArray(guids)) {
                        guids.forEach((guid: string) => {
                          if (typeof guid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                            allGuidsFromMains.push(guid);
                          }
                        });
                      }
                    });
                  }
                });
              }
            });

            console.log('[DDT][Wizard][heuristic-confirm] 🔍 GUID estratti dai stepPrompts:', {
              totalGuids: allGuidsFromMains.length,
              uniqueGuids: [...new Set(allGuidsFromMains)].length,
              guids: [...new Set(allGuidsFromMains)]
            });

            return (
              <div style={{ padding: 16 }}>
                {/* Pannello principale con bordino arrotondato */}
                <div style={{
                  border: '1px solid #334155',
                  borderRadius: 12,
                  padding: 20,
                  background: '#1e293b'
                }}>
                  {/* Header semplificato */}
                  <p style={{
                    color: '#e2e8f0',
                    marginBottom: 16,
                    fontSize: 16,
                    fontWeight: 500
                  }}>
                    I guess you want to retrieve this kind of data:
                  </p>

                  {/* Struttura dati con bordino arrotondato */}
                  <div style={{
                    border: '1px solid #475569',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    background: '#0f172a'
                  }}>
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

                  {/* Bottoni in basso a destra */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 12
                  }}>
                    <button
                      onClick={async () => {
                        console.log('🔵 [YES_BUTTON] Click ricevuto');

                        const { schema, icon, mains0, root } = pendingHeuristicMatch;
                        setPendingHeuristicMatch(null);
                        setShowInputAlongsideConfirm(false);
                        setDetectTypeIcon(icon);

                        // ✅ DEBUG: Log stepPrompts structure per capire perché hasStepPrompts è false
                        const debugMains0 = mains0.map((m: any) => ({
                          label: m.label,
                          hasStepPrompts: !!m.stepPrompts,
                          stepPromptsType: typeof m.stepPrompts,
                          stepPromptsValue: m.stepPrompts,
                          stepPromptsKeys: m.stepPrompts ? Object.keys(m.stepPrompts) : [],
                          allKeys: Object.keys(m),
                          subData: (m.subData || []).map((s: any) => ({
                            label: s.label,
                            hasStepPrompts: !!(s as any).stepPrompts,
                            stepPromptsType: typeof (s as any).stepPrompts,
                            stepPromptsValue: (s as any).stepPrompts,
                            stepPromptsKeys: (s as any).stepPrompts ? Object.keys((s as any).stepPrompts) : [],
                            allKeys: Object.keys(s)
                          }))
                        }));
                        console.log('🔵 [YES_BUTTON] DEBUG mains0 stepPrompts', JSON.stringify(debugMains0, null, 2));
                        console.log('🔵 [YES_BUTTON] DEBUG schema', {
                          schemaHasStepPrompts: !!(schema && schema.stepPrompts),
                          schemaStepPrompts: schema?.stepPrompts,
                          schemaKeys: schema ? Object.keys(schema) : []
                        });

                        // ✅ FIX: Controlla stepPrompts sia a livello mainData che schema
                        const hasMainStepPrompts = mains0.some((m: any) => m.stepPrompts && typeof m.stepPrompts === 'object' && Object.keys(m.stepPrompts).length > 0);
                        const hasSubDataStepPrompts = mains0.some((m: any) =>
                          m.subData && Array.isArray(m.subData) && m.subData.some((s: any) =>
                            s.stepPrompts && typeof s.stepPrompts === 'object' && Object.keys(s.stepPrompts).length > 0
                          )
                        );
                        const hasSchemaStepPrompts = !!(schema && schema.stepPrompts && typeof schema.stepPrompts === 'object' && Object.keys(schema.stepPrompts).length > 0);
                        const hasStepPrompts = hasMainStepPrompts || hasSubDataStepPrompts || hasSchemaStepPrompts;

                        console.log('🔵 [YES_BUTTON] hasStepPrompts check:', {
                          hasMainStepPrompts,
                          hasSubDataStepPrompts,
                          hasSchemaStepPrompts,
                          hasStepPrompts
                        });

                        if (hasStepPrompts) {
                          // If stepPrompts are present, go directly to Response Editor
                          console.log('[DDT][Wizard][heuristicMatch] stepPrompts found, going directly to Response Editor');

                          try {
                            // Extract all translation GUIDs from stepPrompts
                            // stepPrompts structure: { start: ['guid-123'], noMatch: ['guid-456', 'guid-789'], ... }
                            // Now contains GUIDs instead of template keys
                            const translationGuids: string[] = [];

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
                                Object.entries(m.stepPrompts).forEach(([stepKey, stepPromptGuids]: [string, any]) => {
                                  // stepPromptGuids is now an array of GUIDs
                                  if (Array.isArray(stepPromptGuids) && stepPromptGuids.length > 0) {
                                    console.log('[DDT][Wizard][heuristicMatch] Found stepPrompts for step', {
                                      mainLabel: m.label,
                                      stepKey,
                                      guids: stepPromptGuids,
                                      allAreGuids: stepPromptGuids.every((g: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(g))
                                    });
                                    // Filter only valid GUIDs (skip any legacy template keys)
                                    stepPromptGuids.forEach((guid: string) => {
                                      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                                        translationGuids.push(guid);
                                      } else if (guid.startsWith('template.')) {
                                        // Legacy template key - log warning but skip
                                        console.warn('[DDT][Wizard][heuristicMatch] Found legacy template key in stepPrompts:', guid);
                                      }
                                    });
                                  }
                                });
                              }

                              // Process sub data stepPrompts
                              if (m.subData && Array.isArray(m.subData) && m.subData.length > 0) {
                                m.subData.forEach((sub: any, subIdx: number) => {
                                  const hasSubStepPrompts = !!(sub as any).stepPrompts && typeof (sub as any).stepPrompts === 'object' && Object.keys((sub as any).stepPrompts).length > 0;

                                  if (hasSubStepPrompts) {
                                    Object.entries((sub as any).stepPrompts).forEach(([stepKey, stepPromptGuids]: [string, any]) => {
                                      if (Array.isArray(stepPromptGuids) && stepPromptGuids.length > 0) {
                                        stepPromptGuids.forEach((guid: string) => {
                                          // Filter only valid GUIDs
                                          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                                            translationGuids.push(guid);
                                          } else if (guid.startsWith('template.')) {
                                            console.warn('[DDT][Wizard][heuristicMatch] Found legacy template key in subData stepPrompts:', guid);
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

                            console.log('[DEBUG][WIZARD] Extracted translation GUIDs:', {
                              totalGuids: translationGuids.length,
                              uniqueGuids: [...new Set(translationGuids)].length,
                              guids: translationGuids,
                              validGuids: translationGuids.filter(g => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(g)).length,
                              sampleStepPrompts: mains0.slice(0, 1).map(m => ({
                                label: m.label,
                                stepPrompts: m.stepPrompts,
                                stepPromptsKeys: m.stepPrompts ? Object.keys(m.stepPrompts) : []
                              }))
                            });

                            // Load translations from database using GUIDs
                            let templateTranslations: Record<string, { en: string; it: string; pt: string }> = {};
                            if (translationGuids.length > 0) {
                              try {
                                const uniqueGuids = [...new Set(translationGuids)];
                                console.log('[DEBUG][WIZARD] Loading translations for', uniqueGuids.length, 'unique GUIDs', { guids: uniqueGuids });
                                templateTranslations = await getTemplateTranslations(uniqueGuids);
                                console.log('[DEBUG][WIZARD] Loaded translations from factory', {
                                  requestedGuids: uniqueGuids.length,
                                  loadedGuids: Object.keys(templateTranslations).length,
                                  loadedGuidsList: Object.keys(templateTranslations),
                                  missingGuids: uniqueGuids.filter(g => !(g in templateTranslations)),
                                  sampleTranslations: Object.entries(templateTranslations).slice(0, 3).map(([k, v]) => ({
                                    guid: k,
                                    hasEn: !!v.en,
                                    hasIt: !!v.it,
                                    hasPt: !!v.pt,
                                    enValue: v.en ? v.en.substring(0, 30) : undefined,
                                    itValue: v.it ? v.it.substring(0, 30) : undefined,
                                    ptValue: v.pt ? v.pt.substring(0, 30) : undefined
                                  }))
                                });
                              } catch (err) {
                                console.error('[DEBUG][WIZARD] Failed to load template translations:', err);
                              }
                            } else {
                              console.warn('[DEBUG][WIZARD] No GUIDs extracted from stepPrompts!', {
                                mainsCount: mains0.length,
                                mainsWithStepPrompts: mains0.filter(m => m.stepPrompts).length,
                                sampleMain: mains0[0] ? {
                                  label: mains0[0].label,
                                  hasStepPrompts: !!mains0[0].stepPrompts,
                                  stepPrompts: mains0[0].stepPrompts
                                } : null
                              });
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
                            const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';
                            // ✅ assembleFinalDDT now adds translations to global table via addTranslations callback
                            // Translations are NOT stored in finalDDT.translations anymore
                            // Translations will be saved to database only on explicit save
                            const finalDDT = await assembleFinalDDT(
                              root || 'Data',
                              mains0,
                              emptyStore,
                              {
                                escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
                                templateTranslations: templateTranslations,
                                projectLocale: projectLang,
                                addTranslations: addTranslationsToGlobal // ✅ Add translations to global table
                              }
                            );

                            // ✅ Translations are now in global table, not in finalDDT.translations
                            // action.text will be resolved from global table when needed (in Chat Simulator, etc.)
                            console.log('[DDT][Wizard][heuristicMatch] ✅ DDT assembled, translations in global table', {
                              ddtId: finalDDT.id,
                              label: finalDDT.label,
                              mainsCount: finalDDT.mainData?.length || 0,
                              templateTranslationsCount: Object.keys(templateTranslations).length
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
                            // ❌ REMOVED: finalDDT.translations - translations are now in global table
                            handleClose(finalDDT, {});
                          } catch (err) {
                            console.error('[DDT][Wizard][heuristicMatch] Failed to assemble DDT:', err);
                            error('DDT_WIZARD', 'Failed to assemble DDT with stepPrompts', err);
                          }
                        } else {
                          console.log('🔵 [YES_BUTTON] No stepPrompts, andando a pipeline');

                          const enrichedRes = await enrichConstraintsFor(root, mains0);

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
                          setShowRight(true);
                          setTaskProgress({});
                          setRootProgress(0);
                          setPartialResults({});
                          setSelectedIdx(0);

                          console.log('🔵 [YES_BUTTON] Settando step=pipeline, mains=', finalMains.length);
                          setStep('pipeline');
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
                          const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';
                          // ✅ assembleFinalDDT now adds translations to global table via addTranslations callback
                          const finalDDT = await assembleFinalDDT(
                            schemaRootLabel || 'Data',
                            schemaMains,
                            emptyStore,
                            {
                              escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
                              templateTranslations: templateTranslations,
                              projectLocale: projectLang,
                              addTranslations: addTranslationsToGlobal // ✅ Add translations to global table
                            }
                          );

                          console.log('[DDT][Wizard][stepPrompts] ✅ DDT assembled, translations added to global table', {
                            ddtId: finalDDT.id,
                            label: finalDDT.label,
                            mainsCount: finalDDT.mainData?.length || 0,
                            templateTranslationsCount: Object.keys(templateTranslations).length,
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
                          // ❌ REMOVED: finalDDT.translations - translations are now in global table
                          handleClose(finalDDT, {});
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

          {step === 'pipeline' && (() => {
            console.log('🟢 [PIPELINE] Rendering pipeline, schemaMains.length =', schemaMains.length);
            return (
              <div style={{ position: 'relative' }}>
                {mainDataNodes.map((mainDataNode, mainIdx) => {
                  const mainItem = schemaMains[mainIdx];
                  console.log('🟢 [PIPELINE] Rendering WizardPipelineStep', mainIdx, 'label=', mainDataNode.label, 'visible=', mainIdx === selectedIdx);

                  return (
                    <div
                      key={`pipeline-${mainIdx}-${mainDataNode.label}`}
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
                                // ❌ REMOVED: finalDDT.translations - translations are now in global table
                                pendingCloseRef.current = {
                                  ddt: finalDDT,
                                  translations: {} // Translations are in global table, not in DDT
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
            );
          })()}

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