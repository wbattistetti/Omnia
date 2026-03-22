/**
 * Design-time editor for AI Agent tasks.
 * Generates proposed variables, runtime agent prompt, and sample dialogue via LLM meta-prompt.
 * Persists flat fields on Task for compilation and VariableStore mapping at runtime.
 */
import React from 'react';
import type { EditorProps } from '../types';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { useHeaderToolbarContext } from '../../ResponseEditor/context/HeaderToolbarContext';
import { useAIProvider } from '@context/AIProviderContext';
import { generateAIAgentDesign } from '@services/aiAgentDesignApi';
import type { AIAgentProposedVariable, AIAgentDesignSampleTurn } from '@types/aiAgentDesign';
import { DATA_ENTITY_TYPES, normalizeEntityType } from '@types/dataEntityTypes';
import {
  AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
  mapSampleToPreviewTurns,
  normalizeAgentPreviewFromTask,
  previewTurnsToLegacySample,
  seedPreviewByStyleFromSample,
} from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import { AIAgentPreviewChatPanel } from './AIAgentPreviewChatPanel';
import { variableCreationService } from '@services/VariableCreationService';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import type { ToolbarButton } from '@dock/types';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  Sparkles,
  MessageSquare,
  ListTree,
} from 'lucide-react';

const EMPTY_MAPPINGS: Record<string, string> = {};

const LABEL_CREATE_AGENT = 'Create Agent';
const LABEL_REFINE_AGENT = 'Refine Agent';

function buildTaskFromRaw(raw: any) {
  return {
    agentDesignDescription: String(raw?.agentDesignDescription ?? ''),
    agentPrompt: String(raw?.agentPrompt ?? ''),
    outputVariableMappings: (raw?.outputVariableMappings &&
    typeof raw.outputVariableMappings === 'object' &&
    !Array.isArray(raw.outputVariableMappings)
      ? { ...raw.outputVariableMappings }
      : { ...EMPTY_MAPPINGS }) as Record<string, string>,
    agentProposedFields: Array.isArray(raw?.agentProposedFields)
      ? (raw.agentProposedFields as AIAgentProposedVariable[])
      : [],
    agentSampleDialogue: Array.isArray(raw?.agentSampleDialogue)
      ? (raw.agentSampleDialogue as AIAgentDesignSampleTurn[])
      : [],
    agentInitialStateTemplateJson: String(raw?.agentInitialStateTemplateJson ?? '{}'),
    agentDesignFrozen: Boolean(raw?.agentDesignFrozen),
    agentDesignHasGeneration:
      typeof raw?.agentDesignHasGeneration === 'boolean'
        ? raw.agentDesignHasGeneration
        : undefined,
  };
}

export default function AIAgentEditor({ task, onToolbarUpdate, hideHeader }: EditorProps) {
  const instanceId = task.instanceId || task.id;
  const pdUpdate = useProjectDataUpdate();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;
  const { provider, model } = useAIProvider();

  const [designDescription, setDesignDescription] = React.useState('');
  const [agentPrompt, setAgentPrompt] = React.useState('');
  const [outputVariableMappings, setOutputVariableMappings] = React.useState<Record<string, string>>(
    () => ({ ...EMPTY_MAPPINGS })
  );
  const [proposedFields, setProposedFields] = React.useState<AIAgentProposedVariable[]>([]);
  /** Anteprima chat per stile (testi + note designer). */
  const [previewByStyle, setPreviewByStyle] = React.useState<Record<string, AIAgentPreviewTurn[]>>({});
  const [previewStyleId, setPreviewStyleId] = React.useState<string>(AI_AGENT_DEFAULT_PREVIEW_STYLE_ID);
  const [initialStateTemplateJson, setInitialStateTemplateJson] = React.useState('{}');
  const [designNotes, setDesignNotes] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [showPrompt, setShowPrompt] = React.useState(true);
  const [showStateJson, setShowStateJson] = React.useState(false);
  /** Right panel: variables table vs chat simulation (mockup: tab alternativa). */
  const [rightPanelTab, setRightPanelTab] = React.useState<'variables' | 'chat'>('variables');
  const [designFrozen, setDesignFrozen] = React.useState(false);
  const [hasAgentGeneration, setHasAgentGeneration] = React.useState(false);

  const loadFromRepository = React.useCallback(() => {
    if (!instanceId) return;
    const raw = taskRepository.getTask(instanceId);
    if (!raw) return;
    const b = buildTaskFromRaw(raw);
    setDesignDescription(b.agentDesignDescription);
    setAgentPrompt(b.agentPrompt);
    setOutputVariableMappings(b.outputVariableMappings);
    setProposedFields(
      b.agentProposedFields.map((f) => ({
        ...f,
        type: normalizeEntityType(f.type),
      }))
    );
    const legacyTurns = mapSampleToPreviewTurns(
      Array.isArray(b.agentSampleDialogue) ? b.agentSampleDialogue : []
    );
    const { byStyle, styleId } = normalizeAgentPreviewFromTask(raw, legacyTurns);
    setPreviewByStyle(byStyle);
    setPreviewStyleId(styleId);
    setInitialStateTemplateJson(
      b.agentInitialStateTemplateJson.trim() ? b.agentInitialStateTemplateJson : '{}'
    );
    setDesignFrozen(b.agentDesignFrozen);
    setHasAgentGeneration(
      b.agentDesignHasGeneration ??
        (b.agentProposedFields.length > 0 || b.agentPrompt.trim().length > 0)
    );
  }, [instanceId]);

  React.useEffect(() => {
    if (!instanceId) return;
    let existing = taskRepository.getTask(instanceId);
    if (!existing) {
      taskRepository.createTask(
        TaskType.AIAgent,
        null,
        {
          agentDesignDescription: '',
          agentPrompt: '',
          outputVariableMappings: {},
          agentProposedFields: [],
          agentSampleDialogue: [],
          agentPreviewByStyle: {},
          agentPreviewStyleId: AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
          agentInitialStateTemplateJson: '{}',
          agentDesignFrozen: false,
          agentDesignHasGeneration: false,
        } as any,
        instanceId,
        projectId
      );
    }
    loadFromRepository();
  }, [instanceId, projectId, loadFromRepository]);

  React.useEffect(() => {
    if (!instanceId) return;
    taskRepository.updateTask(
      instanceId,
      {
        agentDesignDescription: designDescription,
        agentPrompt,
        outputVariableMappings: { ...outputVariableMappings },
        agentProposedFields: proposedFields,
        agentPreviewByStyle: previewByStyle,
        agentPreviewStyleId: previewStyleId,
        agentSampleDialogue: previewTurnsToLegacySample(
          previewByStyle[previewStyleId] ?? []
        ),
        agentInitialStateTemplateJson: initialStateTemplateJson,
        agentDesignFrozen: designFrozen,
        agentDesignHasGeneration: hasAgentGeneration,
      } as any,
      projectId
    );
  }, [
    instanceId,
    projectId,
    designDescription,
    agentPrompt,
    outputVariableMappings,
    proposedFields,
    previewByStyle,
    previewStyleId,
    initialStateTemplateJson,
    designFrozen,
    hasAgentGeneration,
  ]);

  const primaryAgentActionLabel = hasAgentGeneration ? LABEL_REFINE_AGENT : LABEL_CREATE_AGENT;

  const handleGenerate = React.useCallback(async () => {
    if (designFrozen) return;
    const desc = designDescription.trim();
    if (desc.length < 8) {
      setGenerateError('Description must be at least 8 characters.');
      return;
    }
    setGenerateError(null);
    setGenerating(true);
    try {
      const design = await generateAIAgentDesign({
        userDesc: desc,
        provider,
        model,
      });
      setProposedFields(
        design.proposed_variables.map((v) => ({
          ...v,
          type: normalizeEntityType(v.type),
        }))
      );
      setAgentPrompt(design.agent_prompt);
      setPreviewByStyle(seedPreviewByStyleFromSample(design.sample_dialogue));
      setDesignNotes(design.design_notes || '');
      setInitialStateTemplateJson(JSON.stringify(design.initial_state_template, null, 2));
      setOutputVariableMappings((prev) => {
        const next = { ...prev };
        for (const v of design.proposed_variables) {
          if (!(v.field_name in next)) {
            next[v.field_name] = '';
          }
        }
        return next;
      });
      setRightPanelTab('chat');
      setHasAgentGeneration(true);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [designDescription, designFrozen, provider, model]);

  const resolveOrCreateVarId = React.useCallback(
    (displayName: string): string => {
      const t = displayName.trim();
      if (!t || !projectId) return '';
      const flowId = getActiveFlowCanvasId();
      let id = variableCreationService.getVarIdByVarName(projectId, t, undefined, flowId);
      if (id) return id;
      const nv = variableCreationService.createManualVariable(projectId, t, {
        scope: 'flow',
        scopeFlowId: flowId,
      });
      return nv.varId;
    },
    [projectId]
  );

  /**
   * Collega le variabili di flusso ai field_name e congela il design (solo lettura fino a sblocco).
   */
  const handleImplement = React.useCallback(() => {
    if (!projectId || designFrozen) return;
    setGenerateError(null);
    const next = { ...outputVariableMappings };
    const errors: string[] = [];
    for (const f of proposedFields) {
      if (next[f.field_name]) continue;
      const label = (f.label || f.field_name).trim();
      if (!label) continue;
      try {
        const vid = resolveOrCreateVarId(label);
        if (vid) {
          next[f.field_name] = vid;
        } else {
          errors.push(`Impossibile collegare: ${label}`);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (errors.length > 0) {
      setGenerateError(errors.join(' · '));
      return;
    }
    setOutputVariableMappings(next);
    setDesignFrozen(true);
  }, [projectId, designFrozen, outputVariableMappings, proposedFields, resolveOrCreateVarId]);

  const updateProposedField = React.useCallback(
    (fieldName: string, patch: Partial<AIAgentProposedVariable>) => {
      setProposedFields((prev) =>
        prev.map((p) => (p.field_name === fieldName ? { ...p, ...patch } : p))
      );
    },
    []
  );

  /**
   * Nome variabile in Omnia = label (con spazi). Collega field_name JSON → varId.
   */
  const syncFlowVariableFromLabel = React.useCallback(
    (fieldName: string, labelTrimmed: string) => {
      if (!projectId || designFrozen) return;
      if (!labelTrimmed) {
        setOutputVariableMappings((prev) => {
          const n = { ...prev };
          delete n[fieldName];
          return n;
        });
        return;
      }
      setOutputVariableMappings((prev) => {
        const varIdExisting = prev[fieldName];
        if (varIdExisting) {
          const renamed = variableCreationService.renameVariableByVarId(
            projectId,
            varIdExisting,
            labelTrimmed
          );
          if (renamed) {
            return prev;
          }
        }
        const flowId = getActiveFlowCanvasId();
        let vid = variableCreationService.getVarIdByVarName(
          projectId,
          labelTrimmed,
          undefined,
          flowId
        );
        if (!vid) {
          const nv = variableCreationService.createManualVariable(projectId, labelTrimmed, {
            scope: 'flow',
            scopeFlowId: flowId,
          });
          vid = nv.varId;
        }
        return { ...prev, [fieldName]: vid };
      });
    },
    [projectId, designFrozen]
  );

  const headerColor = '#a78bfa';

  const toolbarButtons = React.useMemo<ToolbarButton[]>(
    () => [
      {
        icon: generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />,
        label: generating ? 'Generating…' : primaryAgentActionLabel,
        onClick: () => {
          void handleGenerate();
        },
        title:
          'Call LLM to propose fields, state template, agent prompt, and sample dialogue (Create Agent first pass, Refine when iterating)',
        disabled: generating || designFrozen,
      },
      {
        icon: <Lock size={16} />,
        label: 'Implement',
        onClick: handleImplement,
        title:
          'Link flow variables from labels and freeze this task design until you unlock it from the editor',
        disabled: designFrozen || generating || !projectId,
      },
    ],
    [designFrozen, generating, handleGenerate, handleImplement, primaryAgentActionLabel, projectId]
  );

  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(toolbarButtons, headerColor);
    }
  }, [hideHeader, onToolbarUpdate, toolbarButtons, headerColor]);

  const headerContext = useHeaderToolbarContext();
  React.useEffect(() => {
    if (headerContext) {
      headerContext.setIcon(<Bot size={18} style={{ color: headerColor }} />);
      headerContext.setTitle(String(task?.label || 'AI Agent'));
      return () => {
        headerContext.setIcon(null);
        headerContext.setTitle(null);
      };
    }
  }, [headerContext, task?.label, headerColor]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {!hideHeader && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 shrink-0"
          style={{ borderLeftColor: headerColor, borderLeftWidth: 4 }}
        >
          <Bot size={20} style={{ color: headerColor }} />
          <span className="font-semibold">AI Agent (design-time)</span>
          <span className="text-xs text-slate-500 ml-auto">Task {instanceId}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left: description, generate, prompt, advanced JSON */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800">
          <section>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Descrizione del task (linguaggio naturale)
            </label>
            <textarea
              className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 p-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Es.: Prenota visita medica: tipo visita, date disponibili, nome e cognome, telefono, conferma. L'utente può correggere in qualsiasi momento."
              value={designDescription}
              onChange={(e) => setDesignDescription(e.target.value)}
              readOnly={designFrozen}
            />
            <p className="text-xs text-slate-500 mt-1">
              Affina il testo e genera finché l&apos;anteprima a destra corrisponde all&apos;intento. Il design si
              salva automaticamente.
            </p>
            {designFrozen ? (
              <p className="mt-2 text-xs text-amber-500/90">
                Design implementato: modifica bloccata fino allo sblocco.
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={generating || designFrozen}
                onClick={() => void handleGenerate()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generating ? 'Generating…' : primaryAgentActionLabel}
              </button>
              {!designFrozen ? (
                <button
                  type="button"
                  disabled={generating || !projectId}
                  onClick={() => void handleImplement()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 text-sm font-medium"
                >
                  <Lock size={16} />
                  Implement
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDesignFrozen(false)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-medium text-slate-200"
                >
                  Modifica design
                </button>
              )}
            </div>
          </section>

          {generateError && (
            <div className="rounded-md bg-red-950/50 border border-red-800 text-red-200 text-sm px-3 py-2">
              {generateError}
            </div>
          )}

          {designNotes ? (
            <div className="rounded-md bg-slate-900/80 border border-slate-700 text-slate-300 text-sm px-3 py-2">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Note di design</span>
              <p className="mt-1">{designNotes}</p>
            </div>
          ) : null}

          <section>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-slate-300 mb-2 hover:text-white"
              onClick={() => setShowPrompt((s) => !s)}
            >
              {showPrompt ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Prompt agente runtime (modificabile)
            </button>
            {showPrompt && (
              <textarea
                className="w-full min-h-[200px] lg:min-h-[280px] rounded-md bg-slate-900 border border-slate-700 p-3 text-xs font-mono text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                readOnly={designFrozen}
              />
            )}
          </section>

          <section>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-slate-400 mb-2 hover:text-slate-200"
              onClick={() => setShowStateJson((s) => !s)}
            >
              {showStateJson ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Stato iniziale (JSON, avanzato)
            </button>
            {showStateJson && (
              <>
                <textarea
                  className="w-full min-h-[120px] rounded-md bg-slate-900 border border-slate-700 p-3 text-xs font-mono text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={initialStateTemplateJson}
                  onChange={(e) => setInitialStateTemplateJson(e.target.value)}
                  readOnly={designFrozen}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Template di riferimento a design-time. In runtime lo stato vive nell&apos;LLM. Mantieni{' '}
                  <code className="text-violet-400">task_completed</code> nel contratto.
                </p>
              </>
            )}
          </section>
        </div>

        {/* Right: tabbed variables + chat preview (mockup) */}
        <div className="w-full lg:w-[min(44%,520px)] xl:w-[min(42%,560px)] shrink-0 flex flex-col min-h-[280px] lg:min-h-0 bg-slate-900/40">
          <div className="flex border-b border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setRightPanelTab('variables')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                rightPanelTab === 'variables'
                  ? 'text-violet-300 border-b-2 border-violet-500 bg-slate-900/60'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ListTree size={16} />
              dati da raccogliere
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                rightPanelTab === 'chat'
                  ? 'text-violet-300 border-b-2 border-violet-500 bg-slate-900/60'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <MessageSquare size={16} />
              Anteprima dialogo
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {rightPanelTab === 'variables' ? (
              <div className="space-y-2">
                {proposedFields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                    Usa {primaryAgentActionLabel} per popolare i dati da raccogliere.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="text-left p-2 font-medium min-w-[160px]">Nome variabile (flusso)</th>
                          <th className="text-left p-2 font-medium w-[150px]">Tipo</th>
                          <th className="text-center p-2 font-medium w-[72px]">Obbl.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposedFields.map((f) => {
                          const linked = Boolean(outputVariableMappings[f.field_name]);
                          return (
                            <tr key={f.field_name} className="border-t border-slate-800 align-top">
                              <td className="p-2">
                                <input
                                  className="w-full rounded bg-slate-950 border border-slate-600 px-2 py-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                  value={f.label}
                                  onChange={(e) =>
                                    updateProposedField(f.field_name, { label: e.target.value })
                                  }
                                  onBlur={(e) =>
                                    syncFlowVariableFromLabel(f.field_name, e.target.value.trim())
                                  }
                                  placeholder="es. Data di nascita"
                                  readOnly={designFrozen}
                                />
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-mono">
                                  <span title="Chiave nello stato JSON inviato all'LLM (field_name)">
                                    JSON: {f.field_name}
                                  </span>
                                  {linked ? (
                                    <span className="text-emerald-600/90">collegata</span>
                                  ) : (
                                    <span className="text-slate-600">non collegata</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2">
                                <select
                                  className="w-full max-w-[180px] rounded bg-slate-950 border border-slate-600 px-2 py-1.5 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                  value={normalizeEntityType(f.type)}
                                  onChange={(e) =>
                                    updateProposedField(f.field_name, {
                                      type: normalizeEntityType(e.target.value),
                                    })
                                  }
                                  disabled={designFrozen}
                                >
                                  {DATA_ENTITY_TYPES.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.labelIt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-600 disabled:opacity-60"
                                  checked={f.required}
                                  onChange={(e) =>
                                    updateProposedField(f.field_name, { required: e.target.checked })
                                  }
                                  title="Obbligatorio"
                                  disabled={designFrozen}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <AIAgentPreviewChatPanel
                selectedStyleId={previewStyleId}
                onStyleIdChange={setPreviewStyleId}
                turns={previewByStyle[previewStyleId] ?? []}
                onTurnsChange={(next) =>
                  setPreviewByStyle((prev) => ({ ...prev, [previewStyleId]: next }))
                }
                readOnly={designFrozen}
                emptyPlaceholder={
                  <div className="h-full min-h-[160px] rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-sm text-slate-500 px-4 text-center">
                    Nessuna simulazione ancora. Usa {primaryAgentActionLabel} e apri questa scheda per vedere tono e
                    sequenza delle domande.
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
