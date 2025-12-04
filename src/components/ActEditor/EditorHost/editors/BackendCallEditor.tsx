import React from 'react';
import type { EditorProps } from '../../EditorHost/types';
import { taskRepository } from '../../../../services/TaskRepository';
import { useProjectDataUpdate, useProjectData } from '../../../../context/ProjectDataContext';
import { getAgentActVisualsByType } from '../../../../components/Flowchart/utils/actVisuals';
import EditorHeader from '../../../../components/common/EditorHeader';
import { Server, Plus, X, Eye, EyeOff, Pencil, Check, Trash2, Table2 } from 'lucide-react';
import { OmniaSelect } from '../../../../components/common/OmniaSelect';
import { flowchartVariablesService } from '../../../../services/FlowchartVariablesService';
import type { ToolbarButton } from '../../../../dock/types';
import TableEditor from './TableEditor';

// Template Globale: solo struttura (parametri interni)
interface GlobalTemplate {
  id: string;
  name: string;
  inputs: Array<{ internalName: string }>;
  outputs: Array<{ internalName: string }>;
}

// Template Locale/Progetto: mapping API + variabili default
interface LocalTemplate {
  id: string;
  globalTemplateId: string;
  apiMappings: {
    inputs: Record<string, string>; // internalName -> apiParam
    outputs: Record<string, string>; // internalName -> apiField
  };
  variableMappings: {
    inputs: Record<string, string>; // internalName -> readableName (e.g., "data di nascita")
    outputs: Record<string, string>; // internalName -> readableName (e.g., "data di nascita")
  };
}

// Config Istanza: può sovrascrivere variabili
interface BackendCallConfig {
  endpoint: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
  };
  // Per ora: struttura semplificata (template locale + eventuali override)
  localTemplateId?: string;
  inputOverrides?: Record<string, string>; // internalName -> readableName (sovrascrive template locale)
  outputOverrides?: Record<string, string>; // internalName -> readableName (sovrascrive template locale)
  // Struttura diretta (per retrocompatibilità e creazione iniziale)
  inputs?: Array<{
    internalName: string; // textbox
    apiParam?: string; // combobox (mapping API)
    variable?: string; // combobox (variabile app)
  }>;
  outputs?: Array<{
    internalName: string; // textbox
    apiField?: string; // combobox (mapping API)
    variable?: string; // combobox (variabile app)
  }>;
  // Mock table: array di righe con valori input/output
  mockTable?: Array<{
    id: string;
    inputs: Record<string, any>;  // internalName -> valore
    outputs: Record<string, any>; // internalName -> valore
  }>;
}

const DEFAULT_CONFIG: BackendCallConfig = {
  endpoint: {
    url: '',
    method: 'POST',
    headers: {}
  },
  inputs: [],
  outputs: []
};

export default function BackendCallEditor({ act, onClose, onToolbarUpdate, hideHeader }: EditorProps) {
  const instanceId = act.instanceId || act.id;
  const pdUpdate = useProjectDataUpdate();
  const { data: projectData } = useProjectData();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;

  // Show/hide API column
  const [showApiColumn, setShowApiColumn] = React.useState(true);

  // Toggle between mapping view and table view
  const [showTableView, setShowTableView] = React.useState(false);

  // Track editing state for inputs and outputs
  const [editingInputs, setEditingInputs] = React.useState<Set<number>>(new Set());
  const [editingOutputs, setEditingOutputs] = React.useState<Set<number>>(new Set());

  // Track hover state for showing edit/delete buttons
  const [hoveredInputRow, setHoveredInputRow] = React.useState<number | null>(null);
  const [hoveredOutputRow, setHoveredOutputRow] = React.useState<number | null>(null);

  // Track pending edits (for cancel functionality)
  const [pendingInputEdits, setPendingInputEdits] = React.useState<Record<number, string>>({});
  const [pendingOutputEdits, setPendingOutputEdits] = React.useState<Record<number, string>>({});

  // Track which placeholders are clicked (to show combo box)
  const [openInputApiParam, setOpenInputApiParam] = React.useState<number | null>(null);
  const [openInputVariable, setOpenInputVariable] = React.useState<number | null>(null);
  const [openOutputApiField, setOpenOutputApiField] = React.useState<number | null>(null);
  const [openOutputVariable, setOpenOutputVariable] = React.useState<number | null>(null);

  // Get available variables for autocomplete
  // ✅ Use readable names directly (e.g., "data di nascita", "data di nascita.giorno")
  // These are the same names used in ConditionEditor and runtime (ctx["data di nascita"])
  const availableVariables = React.useMemo(() => {
    try {
      const vars = flowchartVariablesService.getAllReadableNames();
      return vars; // Return directly, no wrapping in vars["..."]
    } catch {
      // Fallback: try to get from window (if available)
      try {
        const windowVars = (window as any).__omniaVarKeys || [];
        return windowVars; // Return directly
      } catch {
        return [];
      }
    }
  }, [projectData]);

  // Get available API params (placeholder - in futuro da Backend Builder)
  const availableApiParams = React.useMemo(() => {
    // TODO: Load from Backend Builder Sources
    return [];
  }, []);

  // Load or create backend call config from Task
  // ✅ Always start with one empty row for inputs and outputs
  const [config, setConfig] = React.useState<BackendCallConfig>(() => {
    if (!instanceId) {
      return {
        ...DEFAULT_CONFIG,
        inputs: [{ internalName: '', apiParam: '', variable: '' }],
        outputs: [{ internalName: '', apiField: '', variable: '' }]
      };
    }
    let task = taskRepository.getTask(instanceId);
    if (!task) {
      const action = 'CallBackend';
      const initialConfig = {
        ...DEFAULT_CONFIG,
        inputs: [{ internalName: '', apiParam: '', variable: '' }],
        outputs: [{ internalName: '', apiField: '', variable: '' }]
      };
      task = taskRepository.createTask(action, { config: initialConfig }, instanceId, projectId);
      return initialConfig;
    }
    const loaded = task?.value?.config || DEFAULT_CONFIG;
    // Ensure at least one empty row exists
    if (!loaded.inputs || loaded.inputs.length === 0) {
      loaded.inputs = [{ internalName: '', apiParam: '', variable: '' }];
    }
    if (!loaded.outputs || loaded.outputs.length === 0) {
      loaded.outputs = [{ internalName: '', apiField: '', variable: '' }];
    }
    return loaded;
  });

  // Reload config from Task when instanceId changes
  React.useEffect(() => {
    if (!instanceId) return;
    const task = taskRepository.getTask(instanceId);
    if (task?.value?.config) {
      const loaded = task.value.config;
      // Ensure at least one empty row exists
      if (!loaded.inputs || loaded.inputs.length === 0) {
        loaded.inputs = [{ internalName: '', apiParam: '', variable: '' }];
      }
      if (!loaded.outputs || loaded.outputs.length === 0) {
        loaded.outputs = [{ internalName: '', apiField: '', variable: '' }];
      }
      setConfig(loaded);

      // Initialize editing state for empty rows
      const emptyInputIndices = new Set<number>();
      const emptyOutputIndices = new Set<number>();

      (loaded.inputs || []).forEach((input: any, index: number) => {
        if (!input.internalName?.trim()) {
          emptyInputIndices.add(index);
        }
      });

      (loaded.outputs || []).forEach((output: any, index: number) => {
        if (!output.internalName?.trim()) {
          emptyOutputIndices.add(index);
        }
      });

      if (emptyInputIndices.size > 0) {
        setEditingInputs(emptyInputIndices);
      }
      if (emptyOutputIndices.size > 0) {
        setEditingOutputs(emptyOutputIndices);
      }
    }
  }, [instanceId]);

  // Initialize editing state for empty rows on initial mount
  React.useEffect(() => {
    const emptyInputIndices = new Set<number>();
    const emptyOutputIndices = new Set<number>();

    (config.inputs || []).forEach((input, index) => {
      if (!input.internalName.trim()) {
        emptyInputIndices.add(index);
      }
    });

    (config.outputs || []).forEach((output, index) => {
      if (!output.internalName.trim()) {
        emptyOutputIndices.add(index);
      }
    });

    if (emptyInputIndices.size > 0) {
      setEditingInputs(emptyInputIndices);
    }
    if (emptyOutputIndices.size > 0) {
      setEditingOutputs(emptyOutputIndices);
    }
  }, []); // Only on mount

  // Save config to Task when it changes
  React.useEffect(() => {
    if (instanceId && config) {
      taskRepository.updateTaskValue(instanceId, { config }, projectId);
    }
  }, [config, instanceId, projectId]);

  // Save to database on close
  const handleClose = async () => {
    if (instanceId) {
      try {
        const { ProjectDataService } = await import('../../../../services/ProjectDataService');
        const pid = pdUpdate?.getCurrentProjectId() || undefined;
        if (pid) {
          void ProjectDataService.updateInstance(pid, instanceId, { backendCall: config })
            .catch((e: any) => { try { console.warn('[BackendCallEditor][close][PUT fail]', e); } catch { } });
        }
      } catch { }
    }
    onClose?.();
  };

  const updateEndpoint = (updates: Partial<BackendCallConfig['endpoint']>) => {
    setConfig(prev => ({
      ...prev,
      endpoint: { ...prev.endpoint, ...updates }
    }));
  };

  // Input management
  const addInput = () => {
    let newIndex = 0;
    setConfig(prev => {
      newIndex = (prev.inputs || []).length;
      return {
        ...prev,
        inputs: [...(prev.inputs || []), { internalName: '', apiParam: '', variable: '' }]
      };
    });
    // New row starts in editing mode
    setTimeout(() => {
      setEditingInputs(prev => new Set(prev).add(newIndex));
      const input = document.querySelector(`input[data-input-index="${newIndex}"]`) as HTMLInputElement;
      if (input) input.focus();
    }, 0);
  };

  const updateInput = (index: number, updates: Partial<BackendCallConfig['inputs'][0]>) => {
    setConfig(prev => {
      const inputs = [...(prev.inputs || [])];
      inputs[index] = { ...inputs[index], ...updates };

      // Auto-fill: se apiParam è selezionato e internalName è vuoto, auto-compila
      if (updates.apiParam && !inputs[index].internalName) {
        inputs[index].internalName = updates.apiParam;
      }

      return { ...prev, inputs };
    });
  };

  // Auto-append: quando premi Enter nel textbox, aggiungi riga vuota sotto
  // Se il textbox ha un valore, esce dalla modalità editing e diventa label
  const handleInputKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, value: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmedValue = value.trim();

      if (trimmedValue) {
        // Se ha un valore, salva e esci da editing
        updateInput(index, { internalName: trimmedValue });
        setEditingInputs(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        delete pendingInputEdits[index];
        setPendingInputEdits(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }

      // In ogni caso, aggiungi nuova riga vuota
      setConfig(prev => {
        const inputs = [...(prev.inputs || [])];
        inputs.splice(index + 1, 0, { internalName: '', apiParam: '', variable: '' });
        return { ...prev, inputs };
      });

      // Focus sulla nuova riga (next tick)
      setTimeout(() => {
        const nextInput = document.querySelector(`input[data-input-index="${index + 1}"]`) as HTMLInputElement;
        if (nextInput) nextInput.focus();
        // Nuova riga parte in editing
        setEditingInputs(prev => new Set(prev).add(index + 1));
      }, 0);
    } else if (e.key === 'Escape') {
      // Annulla editing
      setEditingInputs(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      setPendingInputEdits(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleOutputKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, value: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmedValue = value.trim();

      if (trimmedValue) {
        // Se ha un valore, salva e esci da editing
        updateOutput(index, { internalName: trimmedValue });
        setEditingOutputs(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        delete pendingOutputEdits[index];
        setPendingOutputEdits(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }

      // In ogni caso, aggiungi nuova riga vuota
      setConfig(prev => {
        const outputs = [...(prev.outputs || [])];
        outputs.splice(index + 1, 0, { internalName: '', apiField: '', variable: '' });
        return { ...prev, outputs };
      });

      // Focus sulla nuova riga (next tick)
      setTimeout(() => {
        const nextInput = document.querySelector(`input[data-output-index="${index + 1}"]`) as HTMLInputElement;
        if (nextInput) nextInput.focus();
        // Nuova riga parte in editing
        setEditingOutputs(prev => new Set(prev).add(index + 1));
      }, 0);
    } else if (e.key === 'Escape') {
      // Annulla editing
      setEditingOutputs(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      setPendingOutputEdits(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  // Start editing input
  const startEditingInput = (index: number) => {
    const currentValue = config.inputs?.[index]?.internalName || '';
    setPendingInputEdits(prev => ({ ...prev, [index]: currentValue }));
    setEditingInputs(prev => new Set(prev).add(index));
  };

  // Save input edit
  const saveInputEdit = (index: number) => {
    const pendingValue = pendingInputEdits[index];
    if (pendingValue !== undefined) {
      updateInput(index, { internalName: pendingValue.trim() });
    }
    setEditingInputs(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setPendingInputEdits(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Cancel input edit
  const cancelInputEdit = (index: number) => {
    setEditingInputs(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setPendingInputEdits(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Start editing output
  const startEditingOutput = (index: number) => {
    const currentValue = config.outputs?.[index]?.internalName || '';
    setPendingOutputEdits(prev => ({ ...prev, [index]: currentValue }));
    setEditingOutputs(prev => new Set(prev).add(index));
  };

  // Save output edit
  const saveOutputEdit = (index: number) => {
    const pendingValue = pendingOutputEdits[index];
    if (pendingValue !== undefined) {
      updateOutput(index, { internalName: pendingValue.trim() });
    }
    setEditingOutputs(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setPendingOutputEdits(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Cancel output edit
  const cancelOutputEdit = (index: number) => {
    setEditingOutputs(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setPendingOutputEdits(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const removeInput = (index: number) => {
    setConfig(prev => {
      const inputs = [...(prev.inputs || [])];
      inputs.splice(index, 1);
      return { ...prev, inputs };
    });
  };

  // Output management
  const addOutput = () => {
    let newIndex = 0;
    setConfig(prev => {
      newIndex = (prev.outputs || []).length;
      return {
        ...prev,
        outputs: [...(prev.outputs || []), { internalName: '', apiField: '', variable: '' }]
      };
    });
    // New row starts in editing mode
    setTimeout(() => {
      setEditingOutputs(prev => new Set(prev).add(newIndex));
      const input = document.querySelector(`input[data-output-index="${newIndex}"]`) as HTMLInputElement;
      if (input) input.focus();
    }, 0);
  };

  const updateOutput = (index: number, updates: Partial<BackendCallConfig['outputs'][0]>) => {
    setConfig(prev => {
      const outputs = [...(prev.outputs || [])];
      outputs[index] = { ...outputs[index], ...updates };

      // Auto-fill: se apiField è selezionato e internalName è vuoto, auto-compila
      if (updates.apiField && !outputs[index].internalName) {
        outputs[index].internalName = updates.apiField;
      }

      return { ...prev, outputs };
    });
  };

  const removeOutput = (index: number) => {
    setConfig(prev => {
      const outputs = [...(prev.outputs || [])];
      outputs.splice(index, 1);
      return { ...prev, outputs };
    });
  };

  // Toolbar buttons
  const toolbarButtons = React.useMemo<ToolbarButton[]>(() => {
    return [
      {
        icon: showApiColumn ? <EyeOff size={16} /> : <Eye size={16} />,
        label: showApiColumn ? 'Hide API' : 'Show API',
        onClick: () => setShowApiColumn(prev => !prev),
        title: showApiColumn ? 'Hide API parameter mapping column' : 'Show API parameter mapping column',
        active: showApiColumn
      },
      {
        icon: <Table2 size={16} />,
        label: 'Mock Table',
        onClick: () => setShowTableView(prev => !prev),
        title: showTableView ? 'Show mapping editor' : 'Show mock table',
        active: showTableView
      }
    ];
  }, [showApiColumn, showTableView]);

  // Update toolbar when it changes (for docking mode)
  const headerColor = '#94a3b8'; // Gray color for BackendCall
  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(toolbarButtons, headerColor);
    }
  }, [hideHeader, toolbarButtons, onToolbarUpdate, headerColor]);

  const type = String(act?.type || 'BackendCall') as any;
  const { Icon, color } = getAgentActVisualsByType(type, false);

  return (
    <div className="h-full bg-slate-900 flex flex-col min-h-0" style={{ color: '#e5e7eb' }}>
      {!hideHeader && (
        <EditorHeader
          icon={<Server size={18} style={{ color: color || '#94a3b8' }} />}
          title={String(act?.label || 'Backend Call')}
          color="slate"
          onClose={handleClose}
          toolbarButtons={toolbarButtons}
        />
      )}

      <div className="flex-1 min-h-0 overflow-auto p-3">
        {/* Endpoint Configuration - Compact (hidden when table view is active) */}
        {!showTableView && (
          <div className="mb-3 flex gap-3 items-center">
            <div className="flex-1">
              <input
                type="text"
                value={config.endpoint.url}
                onChange={(e) => updateEndpoint({ url: e.target.value })}
                placeholder="https://api.example.com/endpoint"
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={config.endpoint.method}
              onChange={(e) => updateEndpoint({ method: e.target.value as any })}
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        )}

        {/* Two Column Layout: Input (left) + Output (right) OR Table View */}
        {showTableView ? (
          <TableEditor
            inputs={config.inputs || []}
            outputs={config.outputs || []}
            rows={config.mockTable || []}
            onChange={(rows) => setConfig(prev => ({ ...prev, mockTable: rows }))}
          />
        ) : (
        <div className="flex gap-3 items-start">
          {/* Input - Left Column */}
          <div className="border border-slate-700 rounded bg-slate-800 flex flex-shrink-0">
            {/* Rettangolo laterale vuoto con bordo azzurro arrotondato e testo verticale "SEND" */}
            <div
              className="flex-shrink-0 flex items-stretch border-2 border-cyan-500 rounded-lg px-2 py-2"
              style={{
                width: '50px',
                backgroundColor: 'transparent'
              }}
            >
              <div
                className="flex items-center justify-center text-cyan-500 font-semibold uppercase"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontSize: '16px'
                }}
              >
                SEND
              </div>
            </div>
            {/* Contenuto */}
            <div className="flex-1 flex flex-col">
              <div className="p-2 space-y-1">
              {(!config.inputs || config.inputs.length === 0) ? (
                <div className="text-xs text-slate-400 italic text-center py-2">
                  <button
                    onClick={addInput}
                    className="p-1 hover:bg-slate-700 rounded text-blue-400"
                    title="Add input parameter"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                config.inputs.map((input, index) => {
                  const isEditing = editingInputs.has(index);
                  const hasValue = !!input.internalName.trim();
                  const displayValue = isEditing && pendingInputEdits[index] !== undefined
                    ? pendingInputEdits[index]
                    : input.internalName;
                  const isHovered = hoveredInputRow === index;

                  return (
                    <div
                      key={index}
                      className="flex gap-1.5 items-center p-1 bg-slate-900 rounded"
                      onMouseEnter={() => setHoveredInputRow(index)}
                      onMouseLeave={() => setHoveredInputRow(null)}
                      style={{ minHeight: '32px' }}
                    >
                      {/* Campo 1: Nome interno (label o textbox) */}
                      <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '150px' }}>
                        {isEditing || !hasValue ? (
                          // Textbox in editing mode o vuoto
                          <div className="flex items-center gap-1" style={{ width: '100%' }}>
                            <input
                              type="text"
                              data-input-index={index}
                              value={displayValue}
                              onChange={(e) => setPendingInputEdits(prev => ({ ...prev, [index]: e.target.value }))}
                              onKeyDown={(e) => handleInputKeyDown(index, e, e.currentTarget.value)}
                              placeholder="Internal name"
                              className="w-full px-1.5 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-cyan-500 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              style={{ height: '32px', maxWidth: '150px' }}
                              autoFocus={isEditing}
                            />
                            {isEditing && hasValue && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => saveInputEdit(index)}
                                  className="p-1 hover:bg-green-600 rounded text-green-400"
                                  title="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => cancelInputEdit(index)}
                                  className="p-1 hover:bg-red-600 rounded text-red-400"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Label quando compilato (senza icona) - colore azzurro come SEND
                          <div className="flex items-center gap-1.5" style={{ width: '100%' }}>
                            <span className="text-xs text-cyan-500 truncate" style={{ maxWidth: '150px' }}>{input.internalName}</span>
                            {isHovered && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => startEditingInput(index)}
                                  className="p-1 hover:bg-slate-700 rounded text-blue-400"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => removeInput(index)}
                                  className="p-1 hover:bg-red-600 rounded text-red-400"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Campo 2: API Param (placeholder cliccabile, label o combobox) - condizionale */}
                      {showApiColumn && (
                        <div className="flex-shrink-0" style={{ height: '32px', width: '120px' }}>
                          {openInputApiParam === index ? (
                            // Combo box aperta
                            <div style={{
                              transform: 'scale(0.75)',
                              transformOrigin: 'left center',
                              height: '32px',
                              width: '133%'
                            }}>
                              <OmniaSelect
                                variant="dark"
                                options={availableApiParams}
                                value={input.apiParam || null}
                                onChange={(value) => {
                                  updateInput(index, { apiParam: value || '' });
                                  setOpenInputApiParam(null); // Chiudi dopo selezione
                                }}
                                onBlur={() => setOpenInputApiParam(null)}
                                onMenuClose={() => setOpenInputApiParam(null)}
                                placeholder="API param"
                                isCreatable={true}
                                className="text-xs"
                                autoFocus={true}
                              />
                            </div>
                          ) : input.apiParam ? (
                            // Label quando c'è un valore
                            <button
                              onClick={() => setOpenInputApiParam(index)}
                              className="text-xs text-slate-200 px-2 py-1.5 h-8 rounded border border-slate-600 bg-slate-800 w-full text-left hover:border-cyan-500 hover:bg-slate-700 truncate"
                              title="Click to change API param"
                            >
                              {input.apiParam}
                            </button>
                          ) : (
                            // Placeholder quando vuoto
                            <button
                              onClick={() => setOpenInputApiParam(index)}
                              className="text-xs text-slate-400 hover:text-cyan-400 px-2 py-1.5 h-8 rounded border border-dashed border-slate-600 hover:border-cyan-500 bg-slate-800 w-full text-left"
                            >
                              API param?
                            </button>
                          )}
                        </div>
                      )}
                      {/* Campo 3: Variabile (placeholder cliccabile, label o combobox) */}
                      <div className="flex-shrink-0" style={{ height: '32px', width: '120px' }}>
                        {openInputVariable === index ? (
                          // Combo box aperta
                          <div style={{
                            transform: 'scale(0.75)',
                            transformOrigin: 'left center',
                            height: '32px',
                            width: '133%'
                          }}>
                            <OmniaSelect
                              variant="dark"
                              options={availableVariables}
                              value={input.variable || null}
                              onChange={(value) => {
                                updateInput(index, { variable: value || '' });
                                setOpenInputVariable(null); // Chiudi dopo selezione
                              }}
                              onBlur={() => setOpenInputVariable(null)}
                              onMenuClose={() => setOpenInputVariable(null)}
                              placeholder="Variable"
                              isCreatable={true}
                              className="text-xs"
                              autoFocus={true}
                            />
                          </div>
                        ) : input.variable ? (
                          // Label quando c'è un valore
                          <button
                            onClick={() => setOpenInputVariable(index)}
                            className="text-xs text-slate-200 px-2 py-1.5 h-8 rounded border border-slate-600 bg-slate-800 w-full text-left hover:border-cyan-500 hover:bg-slate-700 truncate"
                            title="Click to change variable"
                          >
                            {input.variable}
                          </button>
                        ) : (
                          // Placeholder quando vuoto
                          <button
                            onClick={() => setOpenInputVariable(index)}
                            className="text-xs text-slate-400 hover:text-cyan-400 px-2 py-1.5 h-8 rounded border border-dashed border-slate-600 hover:border-cyan-500 bg-slate-800 w-full text-left"
                          >
                            Variable?
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </div>

          {/* Output - Right Column */}
          <div className="border border-slate-700 rounded bg-slate-800 flex flex-shrink-0">
            {/* Rettangolo laterale vuoto con bordo verde arrotondato e testo verticale "RECEIVE" */}
            <div
              className="flex-shrink-0 flex items-stretch border-2 border-green-500 rounded-lg px-2 py-2"
              style={{
                width: '50px',
                backgroundColor: 'transparent'
              }}
            >
              <div
                className="flex items-center justify-center text-green-500 font-semibold uppercase"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  fontSize: '16px'
                }}
              >
                RECEIVE
              </div>
            </div>
            {/* Contenuto */}
            <div className="flex-1 flex flex-col">
              <div className="p-2 space-y-1">
              {(!config.outputs || config.outputs.length === 0) ? (
                <div className="text-xs text-slate-400 italic text-center py-2">
                  <button
                    onClick={addOutput}
                    className="p-1 hover:bg-slate-700 rounded text-green-400"
                    title="Add output field"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                config.outputs.map((output, index) => {
                  const isEditing = editingOutputs.has(index);
                  const hasValue = !!output.internalName.trim();
                  const displayValue = isEditing && pendingOutputEdits[index] !== undefined
                    ? pendingOutputEdits[index]
                    : output.internalName;
                  const isHovered = hoveredOutputRow === index;

                  return (
                    <div
                      key={index}
                      className="flex gap-1.5 items-center p-1 bg-slate-900 rounded"
                      onMouseEnter={() => setHoveredOutputRow(index)}
                      onMouseLeave={() => setHoveredOutputRow(null)}
                      style={{ minHeight: '32px' }}
                    >
                      {/* Campo 1: Nome interno (label o textbox) */}
                      <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '150px' }}>
                        {isEditing || !hasValue ? (
                          // Textbox in editing mode o vuoto
                          <div className="flex items-center gap-1 flex-shrink-0" style={{ width: '150px' }}>
                            <input
                              type="text"
                              data-output-index={index}
                              value={displayValue}
                              onChange={(e) => setPendingOutputEdits(prev => ({ ...prev, [index]: e.target.value }))}
                              onKeyDown={(e) => handleOutputKeyDown(index, e, e.currentTarget.value)}
                              placeholder="Internal name"
                              className="w-full px-1.5 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-green-500 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                              style={{ height: '32px' }}
                              autoFocus={isEditing}
                            />
                            {isEditing && hasValue && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => saveOutputEdit(index)}
                                  className="p-1 hover:bg-green-600 rounded text-green-400"
                                  title="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => cancelOutputEdit(index)}
                                  className="p-1 hover:bg-red-600 rounded text-red-400"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Label quando compilato (senza icona) - colore verde come RECEIVE
                          <div className="flex items-center gap-1.5" style={{ width: '100%' }}>
                            <span className="text-xs text-green-500 truncate" style={{ maxWidth: '150px' }}>{output.internalName}</span>
                            {isHovered && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => startEditingOutput(index)}
                                  className="p-1 hover:bg-slate-700 rounded text-blue-400"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => removeOutput(index)}
                                  className="p-1 hover:bg-red-600 rounded text-red-400"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Campo 2: API Field (placeholder cliccabile, label o combobox) - condizionale */}
                      {showApiColumn && (
                        <div className="flex-shrink-0" style={{ height: '32px', width: '120px' }}>
                          {openOutputApiField === index ? (
                            // Combo box aperta
                            <div style={{
                              transform: 'scale(0.75)',
                              transformOrigin: 'left center',
                              height: '32px',
                              width: '133%'
                            }}>
                              <OmniaSelect
                                variant="dark"
                                options={availableApiParams}
                                value={output.apiField || null}
                                onChange={(value) => {
                                  updateOutput(index, { apiField: value || '' });
                                  setOpenOutputApiField(null); // Chiudi dopo selezione
                                }}
                                onBlur={() => setOpenOutputApiField(null)}
                                onMenuClose={() => setOpenOutputApiField(null)}
                                placeholder="API field"
                                isCreatable={true}
                                className="text-xs"
                                autoFocus={true}
                              />
                            </div>
                          ) : output.apiField ? (
                            // Label quando c'è un valore
                            <button
                              onClick={() => setOpenOutputApiField(index)}
                              className="text-xs text-slate-200 px-2 py-1.5 h-8 rounded border border-slate-600 bg-slate-800 w-full text-left hover:border-green-500 hover:bg-slate-700 truncate"
                              title="Click to change API field"
                            >
                              {output.apiField}
                            </button>
                          ) : (
                            // Placeholder quando vuoto
                            <button
                              onClick={() => setOpenOutputApiField(index)}
                              className="text-xs text-slate-400 hover:text-green-400 px-2 py-1.5 h-8 rounded border border-dashed border-slate-600 hover:border-green-500 bg-slate-800 w-full text-left"
                            >
                              API field?
                            </button>
                          )}
                        </div>
                      )}
                      {/* Campo 3: Variabile (placeholder cliccabile, label o combobox) */}
                      <div className="flex-shrink-0" style={{ height: '32px', width: '120px' }}>
                        {openOutputVariable === index ? (
                          // Combo box aperta
                          <div style={{
                            transform: 'scale(0.75)',
                            transformOrigin: 'left center',
                            height: '32px',
                            width: '133%'
                          }}>
                            <OmniaSelect
                              variant="dark"
                              options={availableVariables}
                              value={output.variable || null}
                              onChange={(value) => {
                                updateOutput(index, { variable: value || '' });
                                setOpenOutputVariable(null); // Chiudi dopo selezione
                              }}
                              onBlur={() => setOpenOutputVariable(null)}
                              onMenuClose={() => setOpenOutputVariable(null)}
                              placeholder="Variable"
                              isCreatable={true}
                              className="text-xs"
                              autoFocus={true}
                            />
                          </div>
                        ) : output.variable ? (
                          // Label quando c'è un valore
                          <button
                            onClick={() => setOpenOutputVariable(index)}
                            className="text-xs text-slate-200 px-2 py-1.5 h-8 rounded border border-slate-600 bg-slate-800 w-full text-left hover:border-green-500 hover:bg-slate-700 truncate"
                            title="Click to change variable"
                          >
                            {output.variable}
                          </button>
                        ) : (
                          // Placeholder quando vuoto
                          <button
                            onClick={() => setOpenOutputVariable(index)}
                            className="text-xs text-slate-400 hover:text-green-400 px-2 py-1.5 h-8 rounded border border-dashed border-slate-600 hover:border-green-500 bg-slate-800 w-full text-left"
                          >
                            Variable?
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
