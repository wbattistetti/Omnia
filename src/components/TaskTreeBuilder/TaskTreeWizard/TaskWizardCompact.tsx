import React, { useState, useCallback, useEffect } from 'react';
import { AccordionState } from './WizardAI';
import { SchemaNode } from './MainDataCollection';
import { assembleFinalTaskTree } from './assembleFinal';
import { v4 as uuidv4 } from 'uuid';
import { useAIProvider } from '../../../context/AIProviderContext';
import { error } from '../../../utils/logger';
import { useProjectTranslations } from '../../../context/ProjectTranslationsContext';
import { getTemplateTranslations, getAllDialogueTemplates } from '../../../services/ProjectDataService';
import { DialogueTaskService } from '../../../services/DialogueTaskService';
import { buildArtifactStore } from './artifactStore';
import { generateFriendlyWizardMessage } from '../../../utils/textTransformers';
import WizardHeader from './components/WizardHeader';
import WizardTemplateSelector from './components/WizardTemplateSelector';
import WizardAISection from './components/WizardAISection';
import WizardFooter from './components/WizardFooter';

interface DataNode {
  name: string;
  subTasks?: string[];
}

interface TaskWizardCompactProps {
  onCancel: () => void;
  onComplete?: (newTaskTree: any, messages?: any) => void;
  initialTaskTree?: any;
  taskType?: string;
  taskLabel?: string;
}

const TaskWizardCompact: React.FC<TaskWizardCompactProps> = ({
  onCancel,
  onComplete,
  initialTaskTree,
  taskType,
  taskLabel,
}) => {
  // State
  const [userDesc, setUserDesc] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showRefiningTextbox, setShowRefiningTextbox] = useState<boolean>(false);
  const [refiningText, setRefiningText] = useState<string>('');
  const [accordionState, setAccordionState] = useState<AccordionState>('collapsed');
  const [schemaRootLabel, setSchemaRootLabel] = useState<string>(initialTaskTree?.label || '');
  const [mountedDataTree, setMountedDataTree] = useState<SchemaNode[]>(() => {
    const nodes = initialTaskTree?.nodes;
    if (nodes && Array.isArray(nodes) && nodes.length > 0) {
      const mains = (nodes as any[]).map((m: any) => ({
        id: m.id,
        label: m.label,
        type: m.type,
        icon: m.icon,
        constraints: m.constraints || [],
        templateId: m.templateId,
        nlpContract: m.nlpContract,
        subData: Array.isArray((m as any).subTasks) ? (m as any).subTasks.map((s: any) => ({
          id: s.id,
          label: s.label,
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          templateId: s.templateId,
          nlpContract: s.nlpContract,
        })) : (Array.isArray(m.subData) ? m.subData.map((s: any) => ({
          id: s.id,
          label: s.label,
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          templateId: s.templateId,
          nlpContract: s.nlpContract,
        })) : [])
      })) as SchemaNode[];
      return mains;
    }
    return [];
  });

  const [dataNode, setDataNode] = useState<DataNode | null>(() => {
    const label = initialTaskTree?.label || taskLabel || '';
    return {
      name: typeof label === 'string' ? label : String(label || '')
    };
  });

  // Context
  const { provider: selectedProvider, model: selectedModel } = useAIProvider();
  const { addTranslations: addTranslationsToGlobal } = useProjectTranslations();

  // Templates state (moved from WizardInputStep)
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const allTemplates = await getAllDialogueTemplates();
        let filtered = Array.isArray(allTemplates) ? [...allTemplates] : [];

        if (taskType && taskType !== 'UNDEFINED') {
          if (taskType === 'DataRequest') {
            filtered = filtered.filter(t => {
              const kind = t.kind || t.name || t.type || '';
              return kind !== 'intent';
            });
          } else if (taskType === 'ProblemClassification') {
            filtered = filtered.filter(t => {
              const kind = t.kind || t.name || t.type || '';
              return kind === 'intent';
            });
          }
        }

        const sorted = filtered.sort((a, b) => {
          const labelA = (a.label || a.name || '').toLowerCase();
          const labelB = (b.label || b.name || '').toLowerCase();
          return labelA.localeCompare(labelB);
        });

        setTemplates(sorted);
      } catch (err) {
        console.error('[WIZARD_COMPACT][LOAD] Failed to load templates:', err);
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [taskType]);

  // Update dataNode when taskLabel changes
  useEffect(() => {
    if (taskLabel && (!dataNode?.name || dataNode.name.trim() === '')) {
      const label = String(taskLabel || '').trim();
      if (label) {
        setDataNode({ name: label });
      }
    }
  }, [taskLabel, dataNode?.name]);

  // Sync accordion state with selectedTemplateId
  useEffect(() => {
    if (selectedTemplateId) {
      if (accordionState !== 'collapsed') {
        setAccordionState('collapsed');
      }
    }
  }, [selectedTemplateId, accordionState]);

  // Utils
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
      const schema = {
        label: rootLabelIn || 'Data',
        mains: mainsIn.map((m) => ({
          label: m.label,
          type: m.type,
          icon: m.icon,
          subData: (m.subData || []).map(s => ({ label: s.label, type: s.type, icon: s.icon }))
        })),
        text: userDesc
      };
      const res = await fetch(`/step3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schema)
      });
      if (!res.ok) {
        console.warn('[TaskTree][Constraints][response.notOk]', { status: res.status });
        return;
      }
      const result = await res.json();
      const enriched: any = (result && result.ai && result.ai.schema) ? result.ai.schema : {};
      if (!!enriched && typeof enriched === 'object' && Array.isArray((enriched as any).data)) {
        const norm = (v: any) => (v || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
        const enrichedMap = new Map<string, any>();
        for (const m of (enriched as any).data) enrichedMap.set(norm(m.label), m);
        const nextMains = mainsIn.map((existing) => {
          const em = enrichedMap.get(norm(existing.label));
          let nextSub = existing.subData || [];
          if (em && Array.isArray(em.subData) && nextSub.length > 0) {
            const subMap = new Map<string, any>();
            for (const s of em.subData) subMap.set(norm(s.label), s);
            nextSub = nextSub.map((sub) => {
              const es = subMap.get(norm(sub.label));
              return {
                ...sub,
                constraints: Array.isArray(es?.constraints) ? es.constraints : (sub.constraints || [])
              };
            });
          }
          return {
            ...existing,
            constraints: Array.isArray(em?.constraints) ? em.constraints : (existing.constraints || []),
            subData: nextSub
          };
        });
        return { label: rootLabelIn, mains: nextMains };
      }
    } catch (err) {
      console.warn('[TaskTree][Constraints] Failed to enrich:', err);
    }
    return { label: rootLabelIn, mains: mainsIn };
  };

  // handleClose
  const handleClose = useCallback((taskTree?: any, translations?: any) => {
    if (onComplete) {
      onComplete(taskTree, translations);
    } else {
      onCancel();
    }
  }, [onComplete, onCancel]);

  // handleDetectType (compact mode only)
  const handleDetectType = useCallback(async (textToUse?: string) => {
    setIsAIGenerating(true);
    setAccordionState('loading');

    try {
      const textInput = textToUse || userDesc;
      const reqBody = typeof textInput === 'string'
        ? textInput.trim()
        : String(textInput || '').trim();

      if (!reqBody || reqBody === '[object Object]') {
        console.error('[TaskTree][DetectType] ❌ Invalid input:', { textToUse, userDesc, textInput, reqBody });
        setIsAIGenerating(false);
        setAccordionState('collapsed');
        return;
      }

      console.log('[TaskTree][DetectType] 🚀 Starting detection for:', reqBody);

      const urlPrimary = `/step2-with-provider`;
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const ctrl = new AbortController();
      const timeoutMs = 60000;
      const timeoutId = setTimeout(() => {
        try {
          ctrl.abort();
          console.warn('[TaskTree][DetectType][timeout]', { url: urlPrimary, timeoutMs });
        } catch { }
      }, timeoutMs);

      let res = await fetch(urlPrimary, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDesc: reqBody, provider: selectedProvider.toLowerCase(), model: selectedModel }),
        signal: ctrl.signal as any,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Errore comunicazione IA');

      const result = await res.json();
      const ai = result.ai || result;

      let schema;
      if (ai.schema && Array.isArray(ai.schema.data)) {
        schema = ai.schema;
      } else if (Array.isArray(ai.mains)) {
        schema = {
          label: ai.label || 'Data',
          data: ai.mains
        };
      } else {
        throw new Error('Schema non valido');
      }

      if (schema && Array.isArray(schema.data)) {
        const root = schema.label || 'Data';
        const mains0: SchemaNode[] = (schema.data || []).map((m: any) => {
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
            constraints: [],
            nlpContract: m.nlpContract || undefined,
            templateId: m.templateId || undefined,
            kind: m.kind || undefined,
            subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
              label: s.label || s.name || 'Field',
              type: s.type,
              icon: s.icon,
              constraints: [],
              nlpContract: (s as any).nlpContract || undefined,
              templateId: (s as any).templateId || undefined,
              kind: (s as any).kind || undefined
            })) : [],
          } as any;
        });

        const enrichedRes = await enrichConstraintsFor(root, mains0);
        const finalRoot = (enrichedRes && (enrichedRes as any).label) ? (enrichedRes as any).label : root;
        let finalMains: any[] = (enrichedRes && (enrichedRes as any).mains) ? (enrichedRes as any).mains as any[] : mains0 as any[];

        try {
          const inferred = inferSubDataFromText(userDesc);
          if (Array.isArray(finalMains) && finalMains.length > 0 && (!finalMains[0].subData || finalMains[0].subData.length === 0) && inferred.length > 0) {
            finalMains = [{ ...finalMains[0], subData: inferred }];
          }
        } catch { }

        const allAtomic = Array.isArray(finalMains) && finalMains.length > 1 && finalMains.every((m: any) => !Array.isArray((m as any)?.subData) || (m as any).subData.length === 0);
        if (allAtomic) {
          finalMains = [{ label: finalRoot, type: 'object', icon: 'Folder', subData: finalMains }];
        }

        setSchemaRootLabel(finalRoot);
        setMountedDataTree(finalMains);
        setIsAIGenerating(false);
        setAccordionState('structure-ready');
      } else {
        throw new Error('Schema non valido');
      }
    } catch (err: any) {
      console.error('[TaskTree][Wizard][error]', err);
      setIsAIGenerating(false);
      setAccordionState('collapsed');
    }
  }, [userDesc, selectedProvider, selectedModel]);

  // handleCreateWithAI
  const handleCreateWithAI = useCallback(async () => {
    if (isAIGenerating) return;
    setIsAIGenerating(true);
    setAccordionState('loading');
    const textToUse = taskLabel || userDesc;
    await handleDetectType(textToUse);
  }, [isAIGenerating, taskLabel, userDesc, handleDetectType]);

  // handleConfirmStructureFromAccordion
  const handleConfirmStructureFromAccordion = useCallback(async () => {
    if (mountedDataTree.length === 0 || !schemaRootLabel) {
      console.warn('[TaskTreeWizard] Cannot confirm: no structure available');
      return;
    }

    const taskTreeId = schemaRootLabel.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const nodes = mountedDataTree.map((main: any) => ({
      id: main.id || uuidv4(),
      templateId: main.templateId || main.type || 'unknown',
      label: main.label,
      type: main.type,
      icon: main.icon,
      constraints: main.constraints || [],
      dataContract: main.dataContract || main.nlpContract || undefined,
      subNodes: (main.subData || []).map((sub: any) => ({
        id: sub.id || uuidv4(),
        templateId: sub.templateId || sub.type || 'unknown',
        label: sub.label,
        type: sub.type,
        icon: sub.icon,
        constraints: sub.constraints || [],
        dataContract: sub.dataContract || sub.nlpContract || undefined,
      })),
    }));

    const minimalTaskTree = {
      id: taskTreeId,
      labelKey: schemaRootLabel.toLowerCase().replace(/\s+/g, '_'),
      nodes,
      steps: {},
      constraints: [],
      dataContract: undefined,
    };

    handleClose(minimalTaskTree, {});
  }, [mountedDataTree, schemaRootLabel, handleClose]);

  // handleShowRefining
  const handleShowRefining = useCallback(() => {
    setShowRefiningTextbox(true);
  }, []);

  // handleApplyRefining
  const handleApplyRefining = useCallback(async () => {
    if (!refiningText.trim()) return;
    const combinedText = `${taskLabel || ''} ${refiningText.trim()}`.trim();
    if (!combinedText) {
      console.warn('[TaskTreeWizard] handleApplyRefining: no text to refine');
      return;
    }
    setShowRefiningTextbox(false);
    const textToRefine = refiningText.trim();
    setRefiningText('');
    await handleDetectType(combinedText);
  }, [refiningText, taskLabel, handleDetectType]);

  // handleCreateManually
  const handleCreateManually = useCallback(() => {
    setAccordionState('editing');
  }, []);

  // handleTemplateSelect
  const handleTemplateSelect = useCallback((template: any) => {
    console.log('[TaskTree][Wizard][templateSelect] Template selected manually:', template.label);
    const templateId = template._id || template.id || template.name;
    setSelectedTemplateId(templateId);
  }, []);

  // handleChooseThis
  const handleChooseThis = useCallback(async () => {
    if (!selectedTemplateId) return;
    const allTemplates = DialogueTaskService.getAllTemplates();
    const selectedTemplate = allTemplates.find((t: any) => (t._id || t.id || t.name) === selectedTemplateId);
    if (!selectedTemplate) return;

    try {
      const schema = selectedTemplate.schema || selectedTemplate;
      const root = schema.label || selectedTemplate.label || 'Data';
      const mains0: SchemaNode[] = (schema.data || schema.mains || []).map((m: any) => ({
        id: m.id || uuidv4(),
        label: m.label || m.name || 'Field',
        type: m.type,
        icon: m.icon,
        constraints: m.constraints || [],
        templateId: m.templateId || m.type || 'unknown',
        nlpContract: m.nlpContract,
        subData: (m.subData || []).map((s: any) => ({
          id: s.id || uuidv4(),
          label: s.label || s.name || 'Field',
          type: s.type,
          icon: s.icon,
          constraints: s.constraints || [],
          templateId: s.templateId || s.type || 'unknown',
          nlpContract: s.nlpContract,
        }))
      }));

      const hasSteps = !!(selectedTemplate.steps && typeof selectedTemplate.steps === 'object' && Object.keys(selectedTemplate.steps).length > 0);

      if (hasSteps) {
        const translationKeys: string[] = [];
        mains0.forEach((m: any) => {
          const mSteps = m.steps;
          if (mSteps && typeof mSteps === 'object') {
            const nodeId = m.templateId || m.id;
            if (nodeId && mSteps[String(nodeId)]) {
              const nodeSteps = mSteps[String(nodeId)];
              Object.values(nodeSteps).forEach((stepValue: any) => {
                if (Array.isArray(stepValue)) {
                  stepValue.forEach((key: string) => {
                    if (typeof key === 'string' && key.startsWith('template.')) {
                      translationKeys.push(key);
                    }
                  });
                }
              });
            }
          }
          (m.subData || []).forEach((s: any) => {
            const sSteps = s.steps;
            if (sSteps && typeof sSteps === 'object') {
              const nodeId = s.templateId || s.id;
              if (nodeId && sSteps[String(nodeId)]) {
                const nodeSteps = sSteps[String(nodeId)];
                Object.values(nodeSteps).forEach((stepValue: any) => {
                  if (Array.isArray(stepValue)) {
                    stepValue.forEach((key: string) => {
                      if (typeof key === 'string' && key.startsWith('template.')) {
                        translationKeys.push(key);
                      }
                    });
                  }
                });
              }
            }
          });
        });

        let templateTranslations: Record<string, { en: string; it: string; pt: string }> = {};
        if (translationKeys.length > 0) {
          try {
            templateTranslations = await getTemplateTranslations(translationKeys);
          } catch (err) {
            console.error('[TaskTree][Wizard][processTemplate] Failed to load template translations:', err);
          }
        }

        const emptyStore = buildArtifactStore([]);
        const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';

        const finalTaskTree = await assembleFinalTaskTree(
          root || 'Data',
          mains0,
          emptyStore,
          {
            escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
            templateTranslations: templateTranslations,
            projectLocale: projectLang,
            addTranslations: addTranslationsToGlobal,
            contextLabel: taskLabel || root || 'Data',
            templateLabel: root || 'Data',
            aiProvider: selectedProvider.toLowerCase() as 'groq' | 'openai'
          }
        );

        if (!finalTaskTree.nodes || finalTaskTree.nodes.length === 0) {
          console.error('[TaskTree][Wizard][processTemplate] ERROR: TaskTree has no nodes!', finalTaskTree);
          error('TASKTREE_WIZARD', 'TaskTree has no nodes after assembly', new Error('TaskTree has no nodes'));
          return;
        }

        handleClose(finalTaskTree, {});
      } else {
        const minimalTaskTree = {
          label: root || 'Data',
          data: mains0.map((m: any) => ({
            id: m.id,
            label: m.label,
            type: m.type,
            icon: m.icon,
            subData: (m.subData || []).map((s: any) => ({
              id: s.id,
              label: s.label,
              type: s.type,
              icon: s.icon
            }))
          })),
          steps: {}
        };
        handleClose(minimalTaskTree, {});
      }
    } catch (err) {
      console.error('[TaskTree][Wizard][processTemplate] Failed:', err);
      error('TASKTREE_WIZARD', 'Failed to process template', err);
    }
  }, [selectedTemplateId, taskLabel, selectedProvider, addTranslationsToGlobal, handleClose]);

  // Calculate message (moved from WizardInputStep)
  const messageParts = taskLabel ? generateFriendlyWizardMessage(taskLabel) : {
    prefix: 'Non sono riuscito a trovare un modulo adatto per',
    boldPart: '',
    suffix: '.\nProva a vedere se tra quelli disponibili qui sotto ce n\'è uno che fa al caso tuo:'
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        height: 'auto',
        padding: '20px 24px',
      }}
    >
      <WizardHeader
        message={messageParts}
      />

      <WizardTemplateSelector
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        loading={loadingTemplates}
        onSelect={handleTemplateSelect}
        onConfirm={selectedTemplateId ? handleChooseThis : undefined}
      />

      <WizardAISection
        state={accordionState}
        structure={mountedDataTree}
        schemaRootLabel={schemaRootLabel}
        onConfirm={handleConfirmStructureFromAccordion}
        onRefine={handleShowRefining}
        onEditManually={handleCreateManually}
        onStructureChange={setMountedDataTree}
        showRefiningTextbox={showRefiningTextbox}
        refiningText={refiningText}
        onRefiningTextChange={setRefiningText}
        onApplyRefining={handleApplyRefining}
        onCreateWithAI={handleCreateWithAI}
        isAIGenerating={isAIGenerating}
      />

      <WizardFooter
        onCancel={handleClose}
      />
    </div>
  );
};

export default TaskWizardCompact;
