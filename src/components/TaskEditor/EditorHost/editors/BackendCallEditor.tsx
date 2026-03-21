import React from 'react';
import type { EditorProps } from '../../EditorHost/types';
import { taskRepository } from '../../../../services/TaskRepository';
import { TaskType } from '../../../../types/taskTypes';
import { useProjectDataUpdate, useProjectData } from '../../../../context/ProjectDataContext';
import { getTaskVisualsByType } from '../../../../components/Flowchart/utils/taskVisuals';
import { useHeaderToolbarContext } from '../../ResponseEditor/context/HeaderToolbarContext';
import { Server, Eye, EyeOff, Table2, RefreshCw } from 'lucide-react';
import { variableCreationService } from '../../../../services/VariableCreationService';
import { InterfaceMappingEditor } from '../../../../components/FlowMappingPanel/InterfaceMappingEditor';
import {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
  mappingEntriesToBackendInputs,
  mappingEntriesToBackendOutputs,
} from '../../../../components/FlowMappingPanel/backendCallMappingAdapter';
import type { MappingEntry } from '../../../../components/FlowMappingPanel/mappingTypes';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import type { ToolbarButton } from '../../../../dock/types';
import TableEditor from './TableEditor';

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
  // ✅ NEW: Column definitions (active + parked)
  mockTableColumns?: Array<{
    name: string;
    type: 'input' | 'output';
    isActive: boolean;
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

export default function BackendCallEditor({ task, onToolbarUpdate, hideHeader }: EditorProps) { // ✅ RINOMINATO: act → task
  const instanceId = task.instanceId || task.id; // ✅ RINOMINATO: act → task
  const pdUpdate = useProjectDataUpdate();
  const { data: projectData } = useProjectData();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;

  // ✅ State to force re-render of availableVariables when a new variable is created
  const [variablesRefreshKey, setVariablesRefreshKey] = React.useState(0);

  // Show/hide API column (tree: Campo API inputs)
  const [showApiColumn, setShowApiColumn] = React.useState(true);

  // Toggle between mapping view and table view
  const [showTableView, setShowTableView] = React.useState(false);

  // Get available variables for autocomplete
  // ✅ Use readable names directly (e.g., "data di nascita", "data di nascita.giorno")
  // These are the same names used in ConditionEditor and runtime (ctx["data di nascita"])
  const availableVariables = React.useMemo(() => {
    try {
      const projectId = localStorage.getItem('currentProjectId');
      if (projectId) {
        return variableCreationService.getAllVarNames(projectId);
      }
      return [];
    } catch {
      // Fallback: try to get from window (if available)
      try {
        const windowVars = (window as any).__omniaVarKeys || [];
        return windowVars;
      } catch {
        return [];
      }
    }
  }, [projectData, variablesRefreshKey]); // ✅ Include variablesRefreshKey to force re-render

  // ✅ Helper: Convert varId to varName for display
  const getVarNameFromVarId = React.useCallback((varId: string | undefined): string | null => {
    if (!varId || !projectId) return null;
    return variableCreationService.getVarNameByVarId(projectId, varId);
  }, [projectId]);

  // ✅ Helper: Get varId from varName for saving
  const getVarIdFromVarName = React.useCallback((varName: string | undefined): string | null => {
    if (!varName || !projectId) return null;
    return variableCreationService.getVarIdByVarName(projectId, varName, undefined, getActiveFlowCanvasId());
  }, [projectId]);

  // Get available API params (placeholder - in futuro da Backend Builder)
  const availableApiParams = React.useMemo(() => {
    // TODO: Load from Backend Builder Sources
    return [];
  }, []);

  // ─────────────────────────────────────────────────────────
  // Helper: build a BackendCallConfig from a raw Task object
  // Fields are stored FLAT on the Task: task.endpoint, task.inputs, task.outputs, task.mockTable, task.mockTableColumns
  // ─────────────────────────────────────────────────────────
  const buildConfigFromTask = React.useCallback((rawTask: any): BackendCallConfig => {
    const endpoint = rawTask?.endpoint ?? DEFAULT_CONFIG.endpoint;
    const rawIn = Array.isArray(rawTask?.inputs) ? rawTask.inputs : [];
    const rawOut = Array.isArray(rawTask?.outputs) ? rawTask.outputs : [];
    const inputs: BackendCallConfig['inputs'] = rawIn.filter((i: { internalName?: string }) => Boolean(i?.internalName?.trim()));
    const outputs: BackendCallConfig['outputs'] = rawOut.filter((o: { internalName?: string }) =>
      Boolean(o?.internalName?.trim())
    );
    const mockTable: BackendCallConfig['mockTable'] = rawTask?.mockTable;
    const mockTableColumns: BackendCallConfig['mockTableColumns'] = rawTask?.mockTableColumns;

    const cfg: BackendCallConfig = {
      endpoint,
      inputs,
      outputs,
      ...(mockTable !== undefined ? { mockTable } : {}),
      ...(mockTableColumns !== undefined ? { mockTableColumns } : {})
    };
    return cfg;
  }, []);

  // Load or create backend call config from Task
  // Fields are stored FLAT on the Task: task.endpoint, task.inputs, task.outputs, task.mockTable
  const [config, setConfig] = React.useState<BackendCallConfig>(() => {
    if (!instanceId) {
      return {
        ...DEFAULT_CONFIG,
        inputs: [],
        outputs: [],
      };
    }
    let existingTask = taskRepository.getTask(instanceId);
    if (!existingTask) {
      const initialInputs: NonNullable<BackendCallConfig['inputs']> = [];
      const initialOutputs: NonNullable<BackendCallConfig['outputs']> = [];
      taskRepository.createTask(
        TaskType.BackendCall,
        null,
        {
          endpoint: DEFAULT_CONFIG.endpoint,
          inputs: initialInputs,
          outputs: initialOutputs,
        } as any,
        instanceId,
        projectId || undefined
      );
      return { ...DEFAULT_CONFIG, inputs: initialInputs, outputs: initialOutputs };
    }
    return buildConfigFromTask(existingTask);
  });

  // Reload config from Task when instanceId changes (e.g. editor reopened)
  React.useEffect(() => {
    if (!instanceId) return;
    const storedTask = taskRepository.getTask(instanceId);
    if (!storedTask) return;

    const loaded = buildConfigFromTask(storedTask);
    setConfig(loaded);
  }, [instanceId, buildConfigFromTask]);

  // Save config to Task when it changes — flat fields, no wrapper
  React.useEffect(() => {
    if (instanceId && config) {
      taskRepository.updateTask(instanceId, {
        endpoint: config.endpoint,
        inputs: config.inputs,
        outputs: config.outputs,
        ...(config.mockTable !== undefined ? { mockTable: config.mockTable } : {}),
        ...(config.mockTableColumns !== undefined ? { mockTableColumns: config.mockTableColumns } : {})
      } as any, projectId);
    }
  }, [config, instanceId, projectId]);

  // ✅ NEW: Update mockTable columns based on current signature (active + parked columns)
  const updateMockTableColumns = React.useCallback(() => {
    setConfig(prev => {
      const currentInputs = prev.inputs || [];
      const currentOutputs = prev.outputs || [];
      const existingRows = prev.mockTable || [];
      const existingColumns = prev.mockTableColumns || [];

      // ✅ Build sets of current signature column names
      const currentInputNames = new Set(currentInputs.map(inp => inp.internalName).filter(Boolean));
      const currentOutputNames = new Set(currentOutputs.map(out => out.internalName).filter(Boolean));

      // ✅ Build dictionary of existing columns by name
      const columnsByName = new Map<string, { name: string; type: 'input' | 'output'; isActive: boolean }>();
      for (const col of existingColumns) {
        columnsByName.set(col.name, col);
      }

      // ✅ Collect all column names from existing rows (to preserve parked columns with data)
      const allColumnNamesInRows = new Set<string>();
      for (const row of existingRows) {
        if (row.inputs) {
          for (const key of Object.keys(row.inputs)) {
            allColumnNamesInRows.add(key);
          }
        }
        if (row.outputs) {
          for (const key of Object.keys(row.outputs)) {
            allColumnNamesInRows.add(key);
          }
        }
      }

      // ✅ Process input columns
      for (const inputName of currentInputNames) {
        if (columnsByName.has(inputName)) {
          // ✅ Column exists → reactivate it
          const col = columnsByName.get(inputName)!;
          col.isActive = true;
          col.type = 'input';
        } else {
          // ✅ New column → create it as active
          columnsByName.set(inputName, { name: inputName, type: 'input', isActive: true });
        }
      }

      // ✅ Process output columns
      for (const outputName of currentOutputNames) {
        if (columnsByName.has(outputName)) {
          // ✅ Column exists → reactivate it
          const col = columnsByName.get(outputName)!;
          col.isActive = true;
          col.type = 'output';
        } else {
          // ✅ New column → create it as active
          columnsByName.set(outputName, { name: outputName, type: 'output', isActive: true });
        }
      }

      // ✅ Park columns that are no longer in signature
      for (const colName of allColumnNamesInRows) {
        if (!currentInputNames.has(colName) && !currentOutputNames.has(colName)) {
          if (columnsByName.has(colName)) {
            // ✅ Park existing column
            const col = columnsByName.get(colName)!;
            col.isActive = false;
          } else {
            // ✅ Create parked column (preserve data from rows)
            // Try to infer type from existing cells
            const isInInputs = existingRows.some(row => row.inputs && row.inputs[colName] !== undefined);
            const colType = isInInputs ? 'input' : 'output';
            columnsByName.set(colName, { name: colName, type: colType, isActive: false });
          }
        }
      }

      // ✅ Update columns array
      const updatedColumns = Array.from(columnsByName.values());

      return {
        ...prev,
        mockTableColumns: updatedColumns
      };
    });
  }, []);

  // ✅ NEW: Funzione per riorganizzare la mockTable (mantiene compatibilità)
  const reorganizeMockTable = React.useCallback(() => {
    updateMockTableColumns();
  }, [updateMockTableColumns]);

  // ✅ NEW: Auto-riorganizza mockTable quando cambiano input/output (se mockTable esiste)
  React.useEffect(() => {
    if (config.mockTable && config.mockTable.length > 0) {
      const hasInputs = (config.inputs || []).some(inp => inp.internalName);
      const hasOutputs = (config.outputs || []).some(out => out.internalName);

      if (hasInputs || hasOutputs) {
        // Verifica se serve riorganizzare (se ci sono internalName che non corrispondono)
        const needsReorganization = config.mockTable.some(row => {
          const rowInputNames = Object.keys(row.inputs || {});
          const rowOutputNames = Object.keys(row.outputs || {});
          const currentInputNames = (config.inputs || []).map(inp => inp.internalName).filter(Boolean);
          const currentOutputNames = (config.outputs || []).map(out => out.internalName).filter(Boolean);

          // Se ci sono colonne nella riga che non esistono più negli input/output attuali
          const hasObsoleteInputs = rowInputNames.some(name => !currentInputNames.includes(name));
          const hasObsoleteOutputs = rowOutputNames.some(name => !currentOutputNames.includes(name));

          // O se mancano colonne per gli input/output attuali
          const missingInputs = currentInputNames.some(name => !rowInputNames.includes(name));
          const missingOutputs = currentOutputNames.some(name => !rowOutputNames.includes(name));

          return hasObsoleteInputs || hasObsoleteOutputs || missingInputs || missingOutputs;
        });

        if (needsReorganization) {
          // ✅ Auto-riorganizza
          reorganizeMockTable();
        }
      }
    }
  }, [config.inputs, config.outputs, reorganizeMockTable]); // ✅ Dipende da inputs/outputs per riorganizzare quando cambiano

  const updateEndpoint = (updates: Partial<BackendCallConfig['endpoint']>) => {
    setConfig(prev => ({
      ...prev,
      endpoint: { ...prev.endpoint, ...updates }
    }));
  };

  const listIdPrefix = React.useMemo(
    () => `bc${String(instanceId || 'x').replace(/[^a-zA-Z0-9]/g, '') || 'x'}`,
    [instanceId]
  );

  /** Persist variable names in mapping rows: resolve label → varId, create manual variable if missing. */
  const resolveVarIdForLinkedName = React.useCallback(
    (linkedName: string): string => {
      const t = linkedName.trim();
      if (!t) return '';
      const id = getVarIdFromVarName(t);
      if (id) return id;
      if (!projectId) return '';
      try {
        const nv = variableCreationService.createManualVariable(projectId, t);
        setVariablesRefreshKey((k) => k + 1);
        return nv.varId;
      } catch {
        return '';
      }
    },
    [getVarIdFromVarName, projectId]
  );

  const mappingSend = React.useMemo(
    () => backendInputsToMappingEntries(config.inputs, getVarNameFromVarId),
    [config.inputs, getVarNameFromVarId]
  );

  const mappingReceive = React.useMemo(
    () => backendOutputsToMappingEntries(config.outputs, getVarNameFromVarId),
    [config.outputs, getVarNameFromVarId]
  );

  const handleBackendSendChange = React.useCallback(
    (entries: MappingEntry[]) => {
      setConfig((prev) => ({
        ...prev,
        inputs: mappingEntriesToBackendInputs(entries, resolveVarIdForLinkedName),
      }));
    },
    [resolveVarIdForLinkedName]
  );

  const handleBackendReceiveChange = React.useCallback(
    (entries: MappingEntry[]) => {
      setConfig((prev) => ({
        ...prev,
        outputs: mappingEntriesToBackendOutputs(entries, resolveVarIdForLinkedName),
      }));
    },
    [resolveVarIdForLinkedName]
  );

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

  const type = String(task?.type || 'BackendCall') as any;
  // ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
  // Aggiornare per usare getTaskVisuals(type, task?.category, task?.categoryCustom, false)
  const { color } = getTaskVisualsByType(type, false);

  // ✅ ARCHITECTURE: Inject icon and title into main header (no local header)
  const headerContext = useHeaderToolbarContext();
  React.useEffect(() => {
    if (headerContext) {
      // Inject icon and title into main header
      headerContext.setIcon(<Server size={18} style={{ color: color || '#94a3b8' }} />);
      headerContext.setTitle(String(task?.label || 'Backend Call'));

      return () => {
        // Cleanup: remove injected values when editor unmounts
        headerContext.setIcon(null);
        headerContext.setTitle(null);
      };
    }
  }, [headerContext, task?.label, task?.type, color]);

  return (
    <div className="h-full bg-slate-900 flex flex-col min-h-0" style={{ color: '#e5e7eb' }}>
      {/* ✅ ARCHITECTURE: No local header - icon/title/toolbar are injected into main header */}

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
          <>
            {/* ✅ NEW: Pulsante Ricrea MockTable */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={reorganizeMockTable}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1.5"
                title="Riorganizza la mockTable in base agli input/output attuali, mantenendo i valori esistenti quando possibile"
              >
                <RefreshCw size={14} />
                Ricrea MockTable
              </button>
            </div>
            <TableEditor
              inputs={(config.inputs || []).map(input => ({
              ...input,
                variable: input.variable ? getVarNameFromVarId(input.variable) || undefined : undefined
              }))}
              outputs={(config.outputs || []).map(output => ({
                ...output,
                variable: output.variable ? getVarNameFromVarId(output.variable) || undefined : undefined
              }))}
              rows={config.mockTable || []}
              columns={config.mockTableColumns}
              onChange={(rows) => setConfig(prev => ({ ...prev, mockTable: rows }))}
              onColumnsChange={(columns) => setConfig(prev => ({ ...prev, mockTableColumns: columns }))}
            />
          </>
        ) : (
        <div className="flex-1 min-h-[320px] min-w-0 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
          <InterfaceMappingEditor
            variant="backend"
            showVariantToggle={false}
            showEndpoint={false}
            showLayoutHint={false}
            title=""
            listIdPrefix={listIdPrefix}
            backendSend={mappingSend}
            backendReceive={mappingReceive}
            onBackendSendChange={handleBackendSendChange}
            onBackendReceiveChange={handleBackendReceiveChange}
            apiOptions={availableApiParams}
            variableOptions={availableVariables}
            showApiFields={showApiColumn}
            showInterfacePalette={false}
            className="bg-slate-900"
            innerClassName="!p-2"
          />
        </div>
        )}
      </div>
    </div>
  );
}
