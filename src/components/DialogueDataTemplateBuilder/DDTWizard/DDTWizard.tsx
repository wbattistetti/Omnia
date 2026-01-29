import React, { useState, useEffect, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';
import DataCollection, { SchemaNode } from './MainDataCollection';
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
import { DialogueTaskService } from '../../../services/DialogueTaskService';
import { cloneTemplateSteps } from '../../../utils/ddtMergeUtils';
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
  subTasks?: string[];
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
      subTasks: Array<{
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
        id: main.id,  // ✅ CRITICAL: Preserve node ID (GUID from template)
        label: main.label,
        type: main.type,
        icon: main.icon,
        subTasks: main.subTasks.map(sub => ({
          id: sub.id,  // ✅ CRITICAL: Preserve subTasks node ID (GUID from template)
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

const DDTWizard: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void; initialDDT?: any; startOnStructure?: boolean; onSeePrompts?: () => void; taskType?: string; taskLabel?: string }> = ({ onCancel, onComplete, initialDDT, startOnStructure, onSeePrompts, taskType, taskLabel }) => {
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
    if (initialDDT?._inferenceResult?.ai?.schema && initialDDT.data?.length > 0) {
      return 'heuristic-confirm';
    }
    // ✅ NUOVO: Se initialDDT ha data ma senza steps → vai direttamente a 'structure'
    // Il bottone "Build Messages" sarà visibile e porterà a 'pipeline'
    if (initialDDT?.data && Array.isArray(initialDDT.data) && initialDDT.data.length > 0) {
      // ✅ Controlla solo steps a root level
      const hasStepsAtRoot = initialDDT.steps && typeof initialDDT.steps === 'object' && Object.keys(initialDDT.steps).length > 0;
      if (!hasStepsAtRoot) {
        console.log('[DDTWizard] data presente ma senza steps, andando a structure per generare messaggi');
        return 'structure';
      }
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
    if (initialDDT?._inferenceResult?.ai?.schema && initialDDT.data?.length > 0) {
      const mains = (initialDDT.data as any[]).map((m: any) => ({
        id: m.id,  // ✅ CRITICAL: Preserve node ID (GUID from template)
        label: m.label,
        type: m.type,
        icon: m.icon,
        constraints: m.constraints || [],
        // ✅ Steps non sono più dentro data, sono a root level
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: m.nlpContract || undefined,
        templateId: m.templateId || undefined,
        kind: m.kind || undefined,
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          id: s.id,  // ✅ CRITICAL: Preserve subData node ID (GUID from template)
          label: s.label,
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          // ✅ Steps non sono più dentro subData, sono a root level
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
  const [mountedDataTree, setMountedDataTree] = useState<SchemaNode[]>(() => {
    if (initialDDT?.data && Array.isArray(initialDDT.data) && initialDDT.data.length > 0) {
      const mains = (initialDDT.data as any[]).map((m: any) => ({
        id: m.id,  // ✅ CRITICAL: Preserve node ID (GUID from template)
        label: m.label,
        type: m.type,
        icon: m.icon,
        constraints: m.constraints || [],
        templateId: m.templateId,  // ✅ Preserve templateId (ID of template root)
        nlpContract: m.nlpContract,  // ✅ Preserve contract
        // ✅ Steps non sono più dentro data, sono a root level
        // ✅ Support both subTasks (from buildDataTree - Task template references) and subData (legacy)
        subTasks: Array.isArray((m as any).subTasks) ? (m as any).subTasks.map((s: any) => ({
          id: s.id,  // ✅ CRITICAL: Preserve subTasks node ID (GUID from template)
          label: s.label,
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          templateId: s.templateId,  // ✅ Preserve templateId
          nlpContract: s.nlpContract,  // ✅ Preserve contract
          // ✅ Preserva steps per subTasks (solo start, noInput, noMatch)
          steps: s.steps || undefined // ✅ Usa steps invece di steps
        })) : (Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          id: s.id,  // ✅ CRITICAL: Preserve subData node ID (GUID from template)
          label: s.label,
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          templateId: s.templateId,  // ✅ Preserve templateId
          nlpContract: s.nlpContract,  // ✅ Preserve contract
          // ✅ Preserva steps per subData (solo start, noInput, noMatch)
          steps: s.steps || undefined // ✅ Usa steps invece di steps
        })) : [])
      })) as SchemaNode[];
      return mains;
    }
    return [];
  });

  // Check if DDT is composite (has multiple data or is explicitly composite)
  const isCompositeDDT = useMemo(() => {
    return mountedDataTree.length > 1 ||
      (mountedDataTree.length === 1 && ((mountedDataTree[0] as any)?.subTasks && (mountedDataTree[0] as any).subTasks.length > 0) || (mountedDataTree[0]?.subData && mountedDataTree[0].subData.length > 0));
  }, [mountedDataTree]);

  // Save template to Factory (global)
  const handleSaveToFactory = async () => {
    if (!schemaRootLabel || mountedDataTree.length === 0) {
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
        data: mountedDataTree.map(main => ({
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

    if (!schemaRootLabel || mountedDataTree.length === 0) {
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
        data: mountedDataTree.map(main => ({
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
        setMountedDataTree(prev =>
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
  // ✅ FIX: Assicura che name sia sempre una stringa, anche se initialDDT?.label è un oggetto
  // ✅ Usa taskLabel come fallback se initialDDT?.label non è disponibile
  const [dataNode, setDataNode] = useState<DataNode | null>(() => {
    const label = initialDDT?.label || taskLabel || '';
    return {
      name: typeof label === 'string'
        ? label
        : String(label || '')
    };
  });

  // ✅ FIX: Aggiorna dataNode.name quando taskLabel diventa disponibile
  React.useEffect(() => {
    if (taskLabel && (!dataNode?.name || dataNode.name.trim() === '')) {
      const label = String(taskLabel || '').trim();
      if (label) {
        setDataNode({ name: label });
        console.log('[DDTWizard] ✅ Aggiornato dataNode.name con taskLabel:', label);
      }
    }
  }, [taskLabel, dataNode?.name]);
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
        hasdata: !!(ai.schema && Array.isArray(ai.schema.data)),
        dataLength: ai.schema?.data?.length || 0,
        label: ai.schema?.label,
        icon: ai.icon,
        timestamp: new Date().toISOString()
      });

      // ✅ Check if heuristic match was found (has schema.data structure)
      if (ai.schema && Array.isArray(ai.schema.data) && ai.schema.data.length > 0) {
        console.log('[AUTO_DETECT][HEURISTIC_MATCH] ✅✅✅ MATCH TROVATO!', {
          label: ai.schema.label,
          mainsCount: ai.schema.data.length,
          mains: ai.schema.data.map((m: any) => ({ label: m.label, type: m.type, subDataCount: m.subData?.length || 0 })),
          totalElapsedMs: Math.round(totalElapsed),
          timestamp: new Date().toISOString()
        });

        // Instead of processing immediately, save the match and show confirmation
        const schema = ai.schema;
        const root = schema.label || 'Data';
        console.log('[AUTO_DETECT][PROCESS] Preparing match for confirmation', { root, mainsCount: schema.data.length });

        // ✅ DEBUG: Log schema.data per vedere se steps arrivano dall'API
        console.log('🔵 [AUTO_DETECT][MAINS0] Schema.data prima del map', {
          dataLength: schema.data?.length || 0,
          data: schema.data?.map((m: any) => ({
            label: m.label,
            hasSteps: !!m.steps,
            steps: m.steps,
            allKeys: Object.keys(m)
          })) || [],
          schemaHasSteps: schema.data?.some((m: any) => m.steps),
          schemaSteps: schema.data?.map((m: any) => ({
            label: m.label,
            hasSteps: !!m.steps,
            stepsKeys: m.steps ? Object.keys(m.steps) : []
          }))
        });

        const mains0: SchemaNode[] = (schema.data || []).map((m: any) => {
          const label = m.label || m.name || 'Field';
          let type = m.type;
          if (!type || type === 'object') {
            const l = String(label).toLowerCase();
            if (/phone|telephone|tel|cellulare|mobile/.test(l)) type = 'phone' as any;
          }

          // ✅ CRITICAL: Process sub-data and preserve steps
          const processedSubData = Array.isArray(m.subData) ? m.subData.map((s: any) => {
            const subNodeId = s.templateId || s.id;
            const hasSteps = !!(s.steps && subNodeId && s.steps[String(subNodeId)] && typeof s.steps[String(subNodeId)] === 'object' && Object.keys(s.steps[String(subNodeId)]).length > 0);

            if (hasSteps) {
              console.log('✅ [CRITICAL] AUTO_DETECT - SUB-DATA HAS STEPS', {
                main: label,
                sub: s.label,
                subNodeId,
                keys: s.steps[String(subNodeId)] ? Object.keys(s.steps[String(subNodeId)]) : []
              });
            } else {
              console.error('🔴 [CRITICAL] AUTO_DETECT - SUB-DATA MISSING STEPS', {
                main: label,
                sub: s.label,
                subKeys: Object.keys(s),
                hasProp: 'steps' in s
              });
            }

            return {
              label: s.label || s.name || 'Field',
              type: s.type,
              icon: s.icon,
              constraints: [],
              steps: s.steps || undefined, // ✅ Usa steps invece di steps
              // ✅ CRITICO: Preserva nlpContract, templateId, kind anche per sub
              nlpContract: (s as any).nlpContract || undefined,
              templateId: (s as any).templateId || undefined,
              kind: (s as any).kind || undefined
            };
          }) : [];

          const finalsteps = m.steps || schema.steps || null;
          console.log('🔵 [AUTO_DETECT][MAINS0] Main', label, {
            hasMsteps: !!m.steps,
            msteps: m.steps,
            hasSchemasteps: !!schema.steps,
            schemasteps: schema.steps,
            finalsteps: finalsteps
          });

          return {
            label,
            type,
            icon: m.icon,
            constraints: [],
            subData: processedSubData,
            // Include steps from template match if present
            steps: finalsteps,
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
        setMountedDataTree(mains0);
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
        hasdata: !!(ai.schema && Array.isArray(ai.schema.data)),
        dataLength: ai.schema?.data?.length || 0,
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
    const mainNode = mountedDataTree.find(m => m.label === mainLabel);
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

      const dataName = mainLabel;
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
          meaning: dataName,
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
    if (initialDDT?._inferenceResult?.ai?.schema && initialDDT.data?.length > 0) return true;
    return startOnStructure ? true : false;
  });

  // Auto-collapse/expand: quando un main data raggiunge 100%, passa automaticamente al successivo
  useEffect(() => {
    if (step !== 'pipeline') return;
    if (mountedDataTree.length === 0) return;

    const currentMain = mountedDataTree[selectedIdx];
    if (!currentMain) return;

    const currentMainProgress = taskProgress[currentMain.label] || 0;

    // Se il main corrente ha raggiunto 100%, cerca il prossimo non completato
    if (currentMainProgress >= 0.99) { // 0.99 per tolleranza float
      const nextIdx = mountedDataTree.findIndex((m, i) =>
        i > selectedIdx && (taskProgress[m.label] || 0) < 0.99
      );

      if (nextIdx !== -1) {
        // Auto-espandi il prossimo main data
        try {
          console.log(`[DDT][auto-advance] ${currentMain.label} completed (${Math.round(currentMainProgress * 100)}%) → opening ${mountedDataTree[nextIdx].label}`);
        } catch { }
        setSelectedIdx(nextIdx);
      }
    }
  }, [taskProgress, selectedIdx, mountedDataTree, step]);

  // Effect to handle closing when all mains are completed
  React.useEffect(() => {
    if (!pendingCloseRef.current) return;

    if (pendingCloseRef.current && mountedDataTree.length > 0) {
      const completedCount = Object.keys(partialResults).length;
      // Only close if all mains are completed
      if (completedCount === mountedDataTree.length) {
        const { ddt, translations } = pendingCloseRef.current;
        pendingCloseRef.current = null; // Clear before calling to avoid re-triggering
        // Use setTimeout to defer to next tick, avoiding setState during render
        setTimeout(() => {
          handleClose(ddt, translations);
        }, 0);
      }
    }
  }, [partialResults, mountedDataTree.length]);

  // ✅ FIX: Memoizza dataNodes per evitare re-creazione ad ogni render
  const dataNodes = React.useMemo(() => {
    return mountedDataTree.map((mainItem) => ({
      name: (mainItem as any)?.label || 'Data',
      label: (mainItem as any)?.label || 'Data',
      type: (mainItem as any)?.type,
      icon: (mainItem as any)?.icon,
      subData: ((mainItem as any)?.subData || []) as any[],
    }));
  }, [mountedDataTree]);

  // DataNode stabile per pipeline (evita rilanci causati da oggetti inline)
  const pipelineDataNode = React.useMemo(() => {
    const main0 = mountedDataTree[selectedIdx] || mountedDataTree[0] || ({} as any);
    return {
      name: (main0 as any)?.label || 'Data',
      type: (main0 as any)?.type,
      subData: ((main0 as any)?.subData || []) as any[],
    } as any;
  }, [mountedDataTree, selectedIdx]);

  // ✅ Memoizza callback per evitare re-render inutili
  const handleProgress = React.useCallback((m: Record<string, number>) => {
    setTaskProgress((prev) => {
      const updated = { ...(prev || {}), ...(m || {}) };
      // Calculate overall root progress (average of all mains)
      const allProgress = mountedDataTree.map(m => updated[m.label] || 0);
      const avgProgress = allProgress.reduce((sum, p) => sum + p, 0) / mountedDataTree.length;
      updated.__root__ = avgProgress;
      return updated;
    });

    setRootProgress((prev) => {
      // 🎯 CORRETTO: Usa TaskCounter per calcolare task completati/totali
      const dataArray = mountedDataTree.map(m => ({
        label: m.label,
        subData: (m.subData || []).map(s => ({ label: s.label }))
      }));

      const progressMap = taskCounter.calculateRecursiveProgress(dataArray);
      return progressMap.__root__ || 0;
    });
  }, [mountedDataTree]);

  const handleCancelPipeline = React.useCallback(() => {
    setStep('structure');
  }, [setStep]);

  const handleFieldProcessingStates = React.useCallback((updater: (prev: any) => any) => {
    setFieldProcessingStates(updater);
  }, []);

  // Funzione per chiamare la detection AI
  const handleDetectType = async (textToUse?: string) => { // ✅ MODIFICATO: accetta parametro opzionale
    if (step === 'pipeline' || closed) return; // Blocca ogni setState durante la pipeline
    setShowRight(true);
    setStep('loading');
    try { dlog('[DDT][UI] step → loading'); } catch { }
    setErrorMsg(null);
    try {
      // ✅ Deterministico: usa textToUse se fornito, altrimenti userDesc dallo stato
      // ✅ FIX: Converti a stringa per evitare errori se textToUse o userDesc sono oggetti/undefined/null
      const textInput = textToUse || userDesc;
      const reqBody = typeof textInput === 'string'
        ? textInput.trim()
        : String(textInput || '').trim();

      // ✅ Validazione: se reqBody è vuoto o è "[object Object]", logga errore
      if (!reqBody || reqBody === '[object Object]') {
        console.error('[DDT][DetectType] ❌ Invalid input:', {
          textToUse,
          userDesc,
          textInput,
          reqBody,
          textToUseType: typeof textToUse,
          userDescType: typeof userDesc
        });
        setErrorMsg('Input non valido: il testo deve essere una stringa');
        setStep('error');
        return;
      }

      console.log('[DDT][DetectType] 🚀 Starting detection for:', reqBody);
      console.log('[DDT][DetectType] 📊 Current state:', { step, closed, userDesc: reqBody, textToUse });

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
        schemadataCount: ai.schema?.data?.length || 0
      });

      // Handle new AI response structure
      let schema;
      if (ai.schema && Array.isArray(ai.schema.data)) {
        // Old structure: ai.schema.data
        schema = ai.schema;
        console.log('[DDT][DetectType] 📋 Using schema.data structure');
      } else if (Array.isArray(ai.mains)) {
        // New structure: ai.mains directly
        schema = {
          label: ai.label || 'Data',
          data: ai.mains
        };
        console.log('[DDT][DetectType] 📋 Using ai.mains structure');
      } else {
        throw new Error('Schema non valido');
      }

      console.log('[DDT][DetectType][schema]', schema);
      if (schema && Array.isArray(schema.data)) {
        const root = schema.label || 'Data';
        const mains0: SchemaNode[] = (schema.data || []).map((m: any) => {
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
        setMountedDataTree(finalMains);
        setStep('structure');
        try { dlog('[DDT][UI] step → structure', { root: finalRoot, mains: finalMains.length }); } catch { }
        return;
      }
      console.warn('[DDT][DetectType][invalidSchema]', { schema });
      throw new Error('Schema non valido');
    } catch (err: any) {
      console.error('[DDT][Wizard][error]', err);

      // ✅ Enhanced error message with reason
      let msg = '';
      if (err && (err.name === 'AbortError' || err.message === 'The operation was aborted.')) {
        msg = 'Timeout: La richiesta ha impiegato più di 60 secondi. Il backend potrebbe essere lento o il modello AI potrebbe non rispondere.';
      } else if (err.message && err.message.includes('model_not_found')) {
        msg = 'Modello non trovato: Il modello richiesto non esiste o non è accessibile. Verifica la configurazione del provider AI.';
      } else if (err.message && err.message.includes('model_decommissioned')) {
        msg = 'Modello dismesso: Il modello richiesto è stato dismesso. Usa un modello valido.';
      } else if (err.message && err.message.includes('API error')) {
        msg = 'Errore API provider: Verifica la chiave API e la configurazione del provider AI.';
      } else {
        msg = err.message || 'Errore sconosciuto';
      }

      setErrorMsg('Errore IA: ' + msg);
      setStep('error');
      try { dlog('[DDT][UI] step → error'); } catch { }
    }
  };

  // removed old continue

  // Assembla un DDT minimale dalla struttura corrente (root + mains + subData)
  const assembleMinimalDDT = () => {
    const root = (schemaRootLabel || 'Data');
    const mains = (mountedDataTree || []).map((m) => ({
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
      data: mains,
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
      if (!!enriched && typeof enriched === 'object' && Array.isArray((enriched as any).data)) {
        const norm = (v: any) => (v || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
        const enrichedMap = new Map<string, any>();
        for (const m of (enriched as any).data) enrichedMap.set(norm(m.label), m);
        const nextMains = mainsIn.map((existing) => {
          const em = enrichedMap.get(norm(existing.label));
          let nextSub = existing.subData || [];

          console.log('[DDT][Constraints][enrich] 🔍 PROCESSING MAIN FOR CONSTRAINTS', {
            mainLabel: existing.label,
            hassteps: !!(existing as any).steps,
            subDataCount: nextSub.length,
            subDataItems: nextSub.map((s: any) => ({
              label: s.label,
              hassteps: !!(s as any).steps,
              steps: (s as any).steps
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
                hasExistingsteps: !!(sub as any).steps,
                existingsteps: (sub as any).steps,
                hasEnrichedConstraints: Array.isArray(es?.constraints),
                enrichedConstraintsCount: Array.isArray(es?.constraints) ? es.constraints.length : 0
              });

              // Preserva steps se presenti, aggiungi solo i constraints dall'AI
              const preservedsteps = (sub as any).steps || undefined;
              const result = {
                ...sub,
                constraints: Array.isArray(es?.constraints) ? es.constraints : [],
                ...(preservedsteps ? { steps: preservedsteps } : {})
              };

              console.log('[DDT][Constraints][enrich] ✅ SUB DATA RESULT', {
                mainLabel: existing.label,
                subLabel: sub.label,
                hassteps: !!(result as any).steps,
                steps: (result as any).steps,
                constraintsCount: Array.isArray(result.constraints) ? result.constraints.length : 0
              });

              return result;
            });
          } else {
            // Anche se non ci sono enriched subData, preserva i steps esistenti
            nextSub = nextSub.map((sub) => {
              const preservedsteps = (sub as any).steps || undefined;
              return {
                ...sub,
                ...(preservedsteps ? { steps: preservedsteps } : {})
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
          // CRITICAL: Preserve steps if they exist
          const preservedsteps = (existing as any).steps || null;
          return { ...existing, constraints: mainConstraints, subData: nextSub, ...(preservedsteps ? { steps: preservedsteps } : {}) };
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
    setMountedDataTree(prev => {
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
    debug('DDT_WIZARD', 'Handle close', { hasResult: !!result, hasOnComplete: !!onComplete, resultId: result?.id, resultLabel: result?.label, mainsCount: Array.isArray(result?.data) ? result.data.length : 'not-array' });
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
      (step === 'structure' && Array.isArray(mountedDataTree) && mountedDataTree.length > 0) ||
      step === 'pipeline' || step === 'error' || step === 'support'
    )
  );

  const pipelineHeadless = true; // run pipeline headlessly; show progress under structure
  const renderTogglePanel = step !== 'pipeline';

  // Handle manual template selection
  const handleTemplateSelect = React.useCallback((template: any) => {
    console.log('[DDT][Wizard][templateSelect] Template selected manually:', template.label);
    console.log('[DDT][Wizard][templateSelect] Full template structure:', {
      label: template.label,
      name: template.name,
      hasSubDataIds: !!template.subDataIds,
      subDataIdsLength: template.subDataIds?.length || 0,
      subDataIds: template.subDataIds,
      hassteps: !!template.steps,
      type: template.type,
      icon: template.icon,
      allKeys: Object.keys(template)
    });

    // ✅ NUOVA STRUTTURA: Costruisci istanza DDT dal template usando subDataIds
    // NOTA: Un template alla radice non sa se sarà usato come sottodato o come main,
    // quindi può avere tutti i 6 tipi di steps (start, noMatch, noInput, confirmation, notConfirmed, success).
    // Quando lo usiamo come sottodato, filtriamo e prendiamo solo start, noInput, noMatch.
    // Ignoriamo confirmation, notConfirmed, success anche se presenti nel template sottodato.
    const root = template.label || 'Data';
    const subDataIds = template.subDataIds || [];
    let data: any[] = [];

    if (subDataIds.length > 0) {
      // ✅ Template composito: crea UN SOLO data con subData[] popolato
      console.log('[DDT][Wizard][templateSelect] 📦 Template composito, creando istanze per sottodati', {
        subDataIds,
        count: subDataIds.length
      });

      // ✅ PRIMA: Costruisci array di subData instances
      // Per ogni ID in subDataIds, cerca il template corrispondente e crea una sotto-istanza
      const subDataInstances: any[] = [];
      const allTemplates = DialogueTaskService.getAllTemplates();

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
          // ✅ Estrai steps filtrati per sub-tasks (solo start, noInput, noMatch)
          const subTemplateId = subTemplate.id || subTemplate._id || subId;
          let filteredSteps = undefined;

          if (subTemplate.steps && subTemplateId) {
            const nodeSteps = subTemplate.steps[String(subTemplateId)];
            if (nodeSteps && typeof nodeSteps === 'object') {
              const filtered = {};
              const allowedStepTypes = ['start', 'noInput', 'noMatch'];
              for (const stepType of allowedStepTypes) {
                if (nodeSteps[stepType]) {
                  filtered[stepType] = nodeSteps[stepType];
                }
              }
              if (Object.keys(filtered).length > 0) {
                filteredSteps = { [String(subTemplateId)]: filtered };
              }
            }
          }

          // ✅ Usa la label del template trovato (non l'ID!)
          // ✅ CRITICAL: Include node ID from template (preserve GUID)
          const subTemplateNodeId = subTemplate.data?.[0]?.id || subTemplate.id || subTemplate._id;
          subDataInstances.push({
            id: subTemplateNodeId,  // ✅ CRITICAL: Preserve node ID (GUID from template)
            label: subTemplate.label || subTemplate.name || 'Sub',
            type: subTemplate.type || subTemplate.name || 'generic',
            icon: subTemplate.icon || 'FileText',
            steps: filteredSteps, // ✅ Usa steps invece di steps
            constraints: subTemplate.dataContracts || subTemplate.constraints || [],
            examples: subTemplate.examples || [],
            subData: [],
            // ✅ CRITICO: Preserva nlpContract, templateId, kind
            nlpContract: subTemplate.nlpContract || undefined,
            templateId: subTemplate.id || subTemplate._id || undefined,  // ✅ ID del template root
            kind: subTemplate.name || subTemplate.type || undefined
          });
        } else {
          console.warn('[DDT][Wizard][templateSelect] ⚠️ Template sottodato non trovato per ID', { subId });
          // Fallback: crea placeholder senza steps
          subDataInstances.push({
            label: subId,
            type: 'generic',
            icon: 'FileText',
            steps: undefined, // ✅ Usa steps invece di steps
            constraints: [],
            examples: [],
            subData: []
          });
        }
      }

      // ✅ POI: Crea UN SOLO data con subData[] popolato (non elementi separati!)
      // L'istanza principale copia TUTTI gli steps dal template (tutti i tipi)
      // ✅ CRITICAL: Include node ID from template (preserve GUID)
      const mainTemplateNodeId = template.data?.[0]?.id || template.id || template._id;
      const mainTemplateId = template.id || template._id;
      const mainInstance = {
        id: mainTemplateNodeId,  // ✅ CRITICAL: Preserve node ID (GUID from template)
        label: template.label || template.name || 'Data',
        type: template.type,
        icon: template.icon || 'Calendar',
        steps: mainTemplateId && template.steps ? { [String(mainTemplateId)]: template.steps[String(mainTemplateId)] } : undefined, // ✅ Usa steps invece di steps
        constraints: template.dataContracts || template.constraints || [],
        examples: template.examples || [],
        subData: subDataInstances, // ✅ Sottodati QUI dentro subData[], non in data[]
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: template.nlpContract || undefined,
        templateId: template.id || template._id || undefined,  // ✅ ID del template root
        kind: template.name || template.type || undefined
      };
      data.push(mainInstance); // ✅ UN SOLO elemento in data
    } else {
      // ✅ Template semplice: crea istanza dal template root
      console.log('[DDT][Wizard][templateSelect] 📄 Template semplice, creando istanza root');
      // ✅ CRITICAL: Include node ID from template (preserve GUID)
      const mainTemplateNodeId = template.data?.[0]?.id || template.id || template._id;
      const mainTemplateId = template.id || template._id;
      data.push({
        id: mainTemplateNodeId,  // ✅ CRITICAL: Preserve node ID (GUID from template)
        label: template.label || template.name || 'Data',
        type: template.type,
        icon: template.icon || 'FileText',
        steps: mainTemplateId && template.steps ? { [String(mainTemplateId)]: template.steps[String(mainTemplateId)] } : undefined, // ✅ Usa steps invece di steps
        constraints: template.dataContracts || template.constraints || [],
        examples: template.examples || [],
        subData: [],
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: template.nlpContract || undefined,
        templateId: template.id || template._id || undefined,  // ✅ ID del template root
        kind: template.name || template.type || undefined
      });
    }

    const mains0: SchemaNode[] = data.map((m: any) => {
      const label = m.label || m.name || 'Field';
      let type = m.type;
      if (!type || type === 'object') {
        const l = String(label).toLowerCase();
        if (/phone|telephone|tel|cellulare|mobile/.test(l)) type = 'phone' as any;
      }
      return {
        id: m.id,  // ✅ CRITICAL: Preserve node ID (GUID from template)
        label,
        type,
        icon: m.icon,
        constraints: m.constraints || [],
        // ✅ Preserva subData con i loro steps filtrati
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          id: s.id,  // ✅ CRITICAL: Preserve subData node ID (GUID from template)
          label: s.label || s.name || 'Field',
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          // ✅ Preserva steps filtrati (solo start, noInput, noMatch) per sottodati
          steps: s.steps || undefined, // ✅ Usa steps invece di steps
          // ✅ CRITICO: Preserva nlpContract, templateId, kind anche per sub
          nlpContract: (s as any).nlpContract || undefined,
          templateId: (s as any).templateId || undefined,
          kind: (s as any).kind || undefined
        })) : [],
        // ✅ Include steps completi (tutti i tipi) per main
        steps: (() => {
          const mainNodeId = m.templateId || m.id || template.id || template._id;
          if (mainNodeId) {
            const mSteps = m.steps && mainNodeId ? m.steps[String(mainNodeId)] : undefined;
            const tSteps = template.steps && mainNodeId ? template.steps[String(mainNodeId)] : undefined;
            const finalSteps = mSteps || tSteps;
            return finalSteps ? { [String(mainNodeId)]: finalSteps } : undefined;
          }
          return undefined;
        })(), // ✅ Usa steps invece di steps
        // ✅ CRITICO: Preserva nlpContract, templateId, kind
        nlpContract: m.nlpContract || undefined,
        templateId: m.templateId || undefined,
        kind: m.kind || undefined
      } as any;
    });

    // Create a fake schema for consistency
    const schema = {
      label: root,
      data: mains0
    };

    console.log('[DDT][Wizard][templateSelect] Processed mains0:', {
      count: mains0.length,
      mains: mains0.map(m => ({
        label: m.label,
        type: m.type,
        icon: m.icon,
        subDataCount: m.subData?.length || 0,
        hassteps: !!(m as any).steps,
        stepsKeys: (m as any).steps ? Object.keys((m as any).steps) : [],
        subDataWithsteps: (m.subData || []).map((s: any) => ({
          label: s.label,
          hassteps: !!s.steps,
          stepsKeys: s.steps ? Object.keys(s.steps) : []
        }))
      }))
    });

    // Process as if it were a heuristic match
    setPendingHeuristicMatch({ schema, icon: template.icon || null, mains0, root });
    setShowInputAlongsideConfirm(false);
    setSchemaRootLabel(root);
    setMountedDataTree(mains0);
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
            taskType={taskType}
            taskLabel={taskLabel} // ✅ LOGICA CORRETTA: nello step 'input', dataNode è vuoto, quindi taskLabel è la fonte primaria
          />
        </div>
      )}

      {/* Confirmation panel - show if pendingHeuristicMatch exists */}
      {pendingHeuristicMatch && (
        <div style={{ overflow: 'auto', borderLeft: '1px solid #1f2340', padding: 12 }}>
          {step === 'heuristic-confirm' && pendingHeuristicMatch && (() => {
            const { schema, icon, mains0, root } = pendingHeuristicMatch;
            const displayMains = mountedDataTree.length > 0 ? mountedDataTree : mains0;
            const displayRoot = schemaRootLabel || root;

            // ✅ Estrai GUID dai steps per debug traduzioni (solo una volta, in useMemo)
            // ✅ RIMOSSO: Log infinito - l'estrazione GUID non è più necessaria qui
            // (viene fatta quando necessario, non ad ogni render)

            return (
              <div style={{ padding: 8 }}>
                {/* Layout compatto senza pannello esterno */}
                {/* Header compatto */}
                <p style={{
                  color: '#e2e8f0',
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: 500
                }}>
                  I guess you want to retrieve this kind of data:
                </p>

                {/* Struttura dati compatta senza bordo esterno */}
                <div style={{
                  marginBottom: 12,
                  background: 'transparent'
                }}>
                  <DataCollection
                    rootLabel={displayRoot}
                    mains={displayMains}
                    onChangeMains={setMountedDataTree}
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
                    compact={true}
                  />
                </div>

                {/* Bottoni compatti */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8
                }}>
                    <button
                      onClick={async () => {
                        const t0 = performance.now();
                        console.log('🔵 [YES_BUTTON] Click ricevuto', { timestamp: new Date().toISOString() });

                        const { schema, icon, mains0, root } = pendingHeuristicMatch;
                        setPendingHeuristicMatch(null);
                        setShowInputAlongsideConfirm(false);
                        setDetectTypeIcon(icon);

                        // ✅ DEBUG: Log steps structure per capire perché hassteps è false
                        const debugMains0 = mains0.map((m: any) => ({
                          label: m.label,
                          hassteps: !!m.steps,
                          stepsType: typeof m.steps,
                          stepsValue: m.steps,
                          stepsKeys: m.steps ? Object.keys(m.steps) : [],
                          nodeId: m.templateId || m.id,
                          allKeys: Object.keys(m),
                          subData: (m.subData || []).map((s: any) => ({
                            label: s.label,
                            hassteps: !!(s as any).steps,
                            stepsType: typeof (s as any).steps,
                            stepsValue: (s as any).steps,
                            stepsKeys: (s as any).steps ? Object.keys((s as any).steps) : [],
                            allKeys: Object.keys(s)
                          }))
                        }));
                        console.log('🔵 [YES_BUTTON] DEBUG mains0 steps', JSON.stringify(debugMains0, null, 2));
                        console.log('🔵 [YES_BUTTON] DEBUG schema', {
                          schemaHassteps: !!(schema && schema.steps),
                          schemasteps: schema?.steps,
                          schemaKeys: schema ? Object.keys(schema) : []
                        });

                        // ✅ Controlla solo steps a root level (non più dentro data)
                        // Nota: durante il wizard, steps vengono ancora creati dentro data temporaneamente
                        // ma vengono estratti a root level da assembleFinalDDT
                        // Qui controlliamo se il template ha già steps (dal database)
                        const hasSteps = !!(schema && schema.steps && typeof schema.steps === 'object' && Object.keys(schema.steps).length > 0);

                        console.log('🔵 [YES_BUTTON] hasSteps check:', {
                          hasSteps,
                          schemaHasSteps: !!(schema?.steps)
                        });

                        if (hasSteps) {
                          // If steps are present, go directly to Response Editor
                          console.log('[DDT][Wizard][heuristicMatch] steps found, going directly to Response Editor');

                          // ✅ Steps vengono gestiti da assembleFinalDDT che estrae i GUID dalle traduzioni
                          // Non serve più estrarre GUID da steps dentro data
                          const t1 = performance.now();
                          console.log(`⏱️ [YES_BUTTON] Tempo fino a assembly: ${(t1 - t0).toFixed(2)}ms`);

                          // ✅ SUPER-OTTIMIZZAZIONE: Usa DDT pre-assemblato se disponibile (ISTANTANEO!)
                          const preAssembledDDT = (initialDDT as any)?._inferenceResult?.ai?.preAssembledDDT;
                          if (preAssembledDDT) {
                            const t2 = performance.now();
                            console.log(`⏱️ [YES_BUTTON] ✅ DDT pre-assemblato trovato - ISTANTANEO! Tempo: ${(t2 - t0).toFixed(2)}ms`);

                            // Set schema for consistency
                            setSchemaRootLabel(root);
                            setMountedDataTree(mains0);

                            // ✅ Usa il DDT già assemblato in background!
                            handleClose(preAssembledDDT, {});

                            const tAfterClose = performance.now();
                            console.log(`⏱️ [YES_BUTTON] 🏁 FINE TOTALE (pre-assembled) - Tempo: ${(tAfterClose - t0).toFixed(2)}ms`);
                            return; // ✅ FATTO! Nessun assembly necessario
                          }

                          const t3 = performance.now();
                          console.log(`⏱️ [YES_BUTTON] Prima di assembleFinalDDT - Tempo: ${(t3 - t0).toFixed(2)}ms`);

                          // Set schema for assembly
                          setSchemaRootLabel(root);
                          setMountedDataTree(mains0);

                          try {
                            const emptyStore = buildArtifactStore([]);
                            const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';
                            // ✅ assembleFinalDDT now adds translations to global table via addTranslations callback
                            // Translations are NOT stored in finalDDT.translations anymore
                            // Translations will be saved to database only on explicit save
                            const tAssemblyStart = performance.now();
                            console.log(`⏱️ [YES_BUTTON] Inizio assembleFinalDDT - Tempo: ${(tAssemblyStart - t0).toFixed(2)}ms`);

                            const finalDDT = await assembleFinalDDT(
                              root || 'Data',
                              mains0,
                              emptyStore,
                              {
                                escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
                                templateTranslations: templateTranslations,
                                projectLocale: projectLang,
                                addTranslations: addTranslationsToGlobal, // ✅ Add translations to global table
                                contextLabel: taskLabel || root || 'Data', // ✅ Context label for prompt adaptation (e.g., "Chiedi la data di nascita del paziente")
                                templateLabel: root || 'Data', // ✅ Template label (e.g., "Date")
                                aiProvider: selectedProvider.toLowerCase() as 'groq' | 'openai' // ✅ AI provider for adaptation
                              }
                            );

                            const tAssemblyEnd = performance.now();
                            console.log(`⏱️ [YES_BUTTON] Fine assembleFinalDDT - Tempo assembly: ${(tAssemblyEnd - tAssemblyStart).toFixed(2)}ms, Tempo totale: ${(tAssemblyEnd - t0).toFixed(2)}ms`);

                            // ✅ Translations are now in global table, not in finalDDT.translations
                            // action.text will be resolved from global table when needed (in Chat Simulator, etc.)
                            console.log('[DDT][Wizard][heuristicMatch] ✅ DDT assembled, translations in global table', {
                              ddtId: finalDDT.id,
                              label: finalDDT.label,
                              mainsCount: finalDDT.data?.length || 0,
                              templateTranslationsCount: Object.keys(templateTranslations).length
                            });

                            // Verify DDT structure before passing to Response Editor
                            if (!finalDDT.data || finalDDT.data.length === 0) {
                              console.error('[DDT][Wizard][heuristicMatch] ERROR: DDT has no data!', finalDDT);
                              error('DDT_WIZARD', 'DDT has no data after assembly', new Error('DDT has no data'));
                              return;
                            }

                            // ✅ Check steps at root level (keyed by nodeId)
                            const firstMainId = finalDDT.data[0]?.id;
                            if (!firstMainId || !finalDDT.steps || !finalDDT.steps[firstMainId] || Object.keys(finalDDT.steps[firstMainId]).length === 0) {
                              console.error('[DDT][Wizard][heuristicMatch] ERROR: DDT has no steps at root level!', {
                                ddtId: finalDDT.id,
                                firstMainId,
                                hasSteps: !!finalDDT.steps,
                                stepsKeys: finalDDT.steps ? Object.keys(finalDDT.steps) : []
                              });
                              error('DDT_WIZARD', 'DDT has no steps at root level after assembly', new Error('DDT has no steps at root level'));
                              return;
                            }

                            const tBeforeClose = performance.now();
                            console.log(`⏱️ [YES_BUTTON] Prima di handleClose - Tempo totale: ${(tBeforeClose - t0).toFixed(2)}ms`);
                            console.log('[DDT][Wizard][heuristicMatch] ✅ DDT structure verified, calling handleClose');

                            // Call onComplete to open Response Editor directly
                            // ❌ REMOVED: finalDDT.translations - translations are now in global table
                            handleClose(finalDDT, {});

                            const tAfterClose = performance.now();
                            console.log(`⏱️ [YES_BUTTON] 🏁 FINE TOTALE - Tempo totale: ${(tAfterClose - t0).toFixed(2)}ms`);
                          } catch (err) {
                            console.error('[DDT][Wizard][heuristicMatch] Failed to assemble DDT:', err);
                            error('DDT_WIZARD', 'Failed to assemble DDT with steps', err);
                          }
                        } else {
                          console.log('🔵 [YES_BUTTON] No steps, andando a pipeline');

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
                          setMountedDataTree(finalMains);
                          setShowRight(true);
                          setTaskProgress({});
                          setRootProgress(0);
                          setPartialResults({});
                          setSelectedIdx(0);

                          // ✅ IMPORTANTE: Non chiudere il wizard quando si passa a pipeline
                          // Il wizard rimane aperto durante tutto il processo pipeline
                          // Solo quando il pipeline completa, verrà chiamato handleClose
                          console.log('🔵 [YES_BUTTON] Settando step=pipeline, mains=', finalMains.length);
                          setStep('pipeline');
                          // ✅ NON chiamare handleClose qui - il wizard deve rimanere aperto
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
                <DataCollection
                  rootLabel={schemaRootLabel || 'Data'}
                  mains={mountedDataTree}
                  onChangeMains={setMountedDataTree}
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
                  {/* ✅ FIX: Cancel nello step 'structure' torna al passo precedente (input) invece di chiudere */}
                  <button
                    onClick={() => {
                      if (step === 'structure') {
                        // Torna al passo input per permettere all'utente di aggiungere dettagli
                        console.log('[DDT][Wizard] Cancel clicked in structure step, returning to input');
                        setStep('input');
                        setShowRight(false);
                      } else {
                        handleClose();
                      }
                    }}
                    style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  {/* Only show "Build Messages" if no steps are present (new DDT structure) */}
                  {!mountedDataTree.some((m: any) => m.steps && Object.keys(m.steps).length > 0) && (
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
                  {/* If steps are present, automatically proceed to Response Editor when user clicks any action */}
                  {mountedDataTree.some((m: any) => {
                    const nodeId = m.templateId || m.id;
                    return m.steps && nodeId && m.steps[nodeId] && Object.keys(m.steps[nodeId]).length > 0;
                  }) && (
                    <button
                      onClick={async () => {
                        try {
                          dlog('[DDT][UI] step → complete with steps');
                        } catch { }

                        // Assemble final DDT with steps
                        try {
                          // Extract all translation keys from steps
                          const { extractTranslationKeysFromSteps } = await import('../../../utils/stepPromptsConverter');
                          const translationKeys: string[] = [];
                          mountedDataTree.forEach((m: any) => {
                            const nodeId = m.templateId || m.id;
                            if (m.steps && nodeId) {
                              const extracted = extractTranslationKeysFromSteps(m.steps, String(nodeId));
                              if (extracted) {
                                Object.values(extracted).forEach((keys: any) => {
                                  if (Array.isArray(keys)) {
                                    translationKeys.push(...keys);
                                  }
                                });
                              }
                            }
                          });

                          console.log('[DDT][Wizard][steps] Extracted translation keys:', translationKeys);

                          // Load translations from database
                          let templateTranslations: Record<string, { en: string; it: string; pt: string }> = {};
                          if (translationKeys.length > 0) {
                            try {
                              templateTranslations = await getTemplateTranslations(translationKeys);
                              console.log('[DDT][Wizard][steps] Loaded', Object.keys(templateTranslations).length, 'translations');
                            } catch (err) {
                              console.error('[DDT][Wizard][steps] Failed to load template translations:', err);
                            }
                          }

                          const emptyStore = buildArtifactStore([]);
                          const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';
                          // ✅ assembleFinalDDT now adds translations to global table via addTranslations callback
                          const finalDDT = await assembleFinalDDT(
                            schemaRootLabel || 'Data',
                            mountedDataTree,
                            emptyStore,
                            {
                              escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
                              templateTranslations: templateTranslations,
                              projectLocale: projectLang,
                              addTranslations: addTranslationsToGlobal // ✅ Add translations to global table
                            }
                          );

                          // ✅ Get first main nodeId for steps lookup
                          const firstMainId = finalDDT.data?.[0]?.id;
                          const firstMainSteps = firstMainId && finalDDT.steps?.[firstMainId] ? Object.keys(finalDDT.steps[firstMainId]) : [];
                          const firstMainMessages = finalDDT.data?.[0]?.messages ? Object.keys(finalDDT.data[0].messages) : [];
                          console.log('[DDT][Wizard][steps] ✅ DDT assembled, translations added to global table', {
                            ddtId: finalDDT.id,
                            label: finalDDT.label,
                            mainsCount: finalDDT.data?.length || 0,
                            templateTranslationsCount: Object.keys(templateTranslations).length,
                            firstMainId,
                            firstMainSteps,
                            firstMainMessages,
                            allStepsKeys: finalDDT.steps ? Object.keys(finalDDT.steps) : []
                          });

                          // Verify DDT structure before passing to Response Editor
                          if (!finalDDT.data || finalDDT.data.length === 0) {
                            console.error('[DDT][Wizard][steps] ERROR: DDT has no data!', finalDDT);
                            error('DDT_WIZARD', 'DDT has no data after assembly', new Error('DDT has no data'));
                            return;
                          }

                          // ✅ Check steps at root level (keyed by nodeId) - firstMainId already declared above
                          if (!firstMainId || !finalDDT.steps || !finalDDT.steps[firstMainId] || Object.keys(finalDDT.steps[firstMainId]).length === 0) {
                            console.error('[DDT][Wizard][steps] ERROR: DDT has no steps at root level!', {
                              ddtId: finalDDT.id,
                              firstMainId,
                              hasSteps: !!finalDDT.steps,
                              stepsKeys: finalDDT.steps ? Object.keys(finalDDT.steps) : []
                            });
                            error('DDT_WIZARD', 'DDT has no steps at root level after assembly', new Error('DDT has no steps at root level'));
                            return;
                          }

                          console.log('[DDT][Wizard][steps] ✅ DDT structure verified, calling handleClose');

                          // Call onComplete to open Response Editor
                          // ❌ REMOVED: finalDDT.translations - translations are now in global table
                          handleClose(finalDDT, {});
                        } catch (err) {
                            console.error('[DDT][Wizard][steps] Failed to assemble DDT:', err);
                            error('DDT_WIZARD', 'Failed to assemble DDT with steps', err);
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
            return (
              <div style={{ position: 'relative' }}>
                {dataNodes.map((dataNode, mainIdx) => {
                  const mainItem = mountedDataTree[mainIdx];

                  return (
                    <div
                      key={`pipeline-${mainIdx}-${dataNode.label}`}
                      style={{
                        display: mainIdx === selectedIdx ? 'block' : 'none'
                      }}
                    >
                      <WizardPipelineStep
                        headless={pipelineHeadless}
                        dataNode={dataNode}
                        detectTypeIcon={(mainItem as any)?.icon || detectTypeIcon}
                        onCancel={handleCancelPipeline}
                        skipDetectType
                        confirmedLabel={dataNode?.name || 'Data'}
                        contextLabel={taskLabel || schemaRootLabel || 'Data'} // ✅ Passa taskLabel come contextLabel per adattare i prompt al contesto - REQUIRED
                        setFieldProcessingStates={handleFieldProcessingStates}
                        progressByPath={taskProgress}
                        onProgress={handleProgress}
                        onComplete={(partialDDT) => {
                          // Accumulate partial result
                          setPartialResults(prev => {
                            const updated = { ...prev, [mainIdx]: partialDDT };

                            // Check if all mains completed
                            const completedCount = Object.keys(updated).length;

                            if (completedCount === mountedDataTree.length) {
                              // All mains completed - assemble final DDT

                              try {
                                // ✅ Merge all data from partial results, PRESERVING templateId from mountedDataTree
                                const dataWithMessages = mountedDataTree.map((mountedMain, idx) => {
                                  const partial = updated[idx];
                                  if (!partial || !partial.data || partial.data.length === 0) {
                                    console.warn(`[DDT][Wizard][parallel] Missing data for idx ${idx}:`, mountedMain.label);
                                    return null;
                                  }
                                  const partialData = partial.data[0]; // Each partial has 1 main

                                  // ✅ CRITICAL: Preserve templateId and id from mountedDataTree
                                  return {
                                    ...partialData, // Messages and structure from buildDDT
                                    templateId: mountedMain.templateId, // ✅ Preserve templateId from mounted tree
                                    id: mountedMain.id || partialData.id, // ✅ Preserve original node ID
                                    // ✅ Preserve templateId for subData recursively
                                    subData: (partialData.subData || []).map((partialSub: any, subIdx: number) => {
                                      const mountedSub = (mountedMain.subData || [])[subIdx];
                                      if (mountedSub) {
                                        return {
                                          ...partialSub,
                                          templateId: mountedSub.templateId, // ✅ Preserve templateId for subData
                                          id: mountedSub.id || partialSub.id
                                        };
                                      }
                                      return partialSub;
                                    })
                                  };
                                }).filter(Boolean);

                                // Merge translations
                                const mergedTranslations: any = {};
                                Object.values(updated).forEach((partial: any) => {
                                  if (partial?.translations) {
                                    Object.assign(mergedTranslations, partial.translations);
                                  }
                                });

                                // ✅ Clone steps from template if templateId is available
                                let clonedSteps: Record<string, any> = {};
                                const firstMain = mountedDataTree[0];
                                const mainTemplateId = (firstMain as any)?.templateId;

                                if (mainTemplateId) {
                                  try {
                                    const template = DialogueTaskService.getTemplate(mainTemplateId);
                                    if (template) {
                                      // ✅ CRITICAL: Usa mountedDataTree (albero montato con templateId corretti), NON dataWithMessages
                                      const { steps } = cloneTemplateSteps(template, mountedDataTree);
                                      clonedSteps = steps;
                                      console.log('✅ [DDT][Wizard][parallel] Steps clonati dal template', {
                                        templateId: mainTemplateId,
                                        stepsCount: Object.keys(clonedSteps).length
                                      });
                                    }
                                  } catch (err) {
                                    console.warn('[DDT][Wizard][parallel] Failed to clone steps from template:', err);
                                  }
                                }

                                const finalDDT = {
                                  id: schemaRootLabel || 'Data',
                                  label: schemaRootLabel || 'Data',
                                  data: dataWithMessages,
                                  steps: clonedSteps, // ✅ Include cloned steps
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
