import React from 'react';
import type { EditorProps } from '../../EditorHost/types';
import { taskRepository } from '../../../../services/TaskRepository';
import { TaskType } from '../../../../types/taskTypes';
import { useProjectDataUpdate, useProjectData } from '../../../../context/ProjectDataContext';
import { useProjectTranslations } from '../../../../context/ProjectTranslationsContext';
import { getTaskVisualsByType } from '../../../../components/Flowchart/utils/taskVisuals';
import { useHeaderToolbarContext } from '../../ResponseEditor/context/HeaderToolbarContext';
import { Server, Eye, EyeOff, Table2, RefreshCw, BookOpen, FlaskConical, ListPlus } from 'lucide-react';
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
import { resolveVariableStoreProjectId } from '../../../../utils/safeProjectId';
import { getVariableLabel } from '../../../../utils/getVariableLabel';
import type { ToolbarButton } from '../../../../dock/types';
import TableEditor from './TableEditor';
import {
  extractOperationFields,
  fetchOpenApiDocument,
  pickOpenApiPathForReadApi,
  slugInternalName,
} from '../../../../services/openApiBackendCallSpec';

function collectUsedInternalNames(cfg: BackendCallConfig): Set<string> {
  const s = new Set<string>();
  for (const i of cfg.inputs || []) {
    const t = i.internalName?.trim();
    if (t) s.add(t);
  }
  for (const o of cfg.outputs || []) {
    const t = o.internalName?.trim();
    if (t) s.add(t);
  }
  return s;
}

function nextUniqueInternalName(base: string, used: Set<string>): string {
  let n = base;
  let k = 0;
  while (used.has(n)) {
    k += 1;
    n = `${base}_${k}`;
  }
  used.add(n);
  return n;
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
    fieldDescription?: string;
    sampleValues?: string[];
  }>;
  outputs?: Array<{
    internalName: string; // textbox
    apiField?: string; // combobox (mapping API)
    variable?: string; // combobox (variabile app)
    fieldDescription?: string;
    sampleValues?: string[];
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
  const { translations } = useProjectTranslations();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;
  const variableStoreProjectId = React.useMemo(
    () => resolveVariableStoreProjectId(projectId),
    [projectId, projectData]
  );

  // ✅ State to force re-render of availableVariables when a new variable is created
  const [variablesRefreshKey, setVariablesRefreshKey] = React.useState(0);

  // Show/hide API column (tree: Campo API inputs)
  const [showApiColumn, setShowApiColumn] = React.useState(true);

  // Toggle between mapping view and table view
  const [showTableView, setShowTableView] = React.useState(false);

  /** Last successful Read API: expected field names from Swagger (for datalist + missing). */
  const [swaggerInputContract, setSwaggerInputContract] = React.useState<string[]>([]);
  const [swaggerOutputContract, setSwaggerOutputContract] = React.useState<string[]>([]);
  const [readApiBusy, setReadApiBusy] = React.useState(false);
  const [testApiBusy, setTestApiBusy] = React.useState(false);

  // Get available variables for autocomplete
  // ✅ Use readable names directly (e.g., "data di nascita", "data di nascita.giorno")
  // These are the same names used in ConditionEditor and runtime (ctx["data di nascita"])
  const availableVariables = React.useMemo(() => {
    try {
      const pid = pdUpdate?.getCurrentProjectId() || localStorage.getItem('currentProjectId');
      if (pid) {
        return variableCreationService.getAllVarNames(pid, getActiveFlowCanvasId());
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
    if (!varId) return null;
    const label = getVariableLabel(varId, translations);
    return label || null;
  }, [translations]);

  // ✅ Helper: Get varId from varName for saving
  const getVarIdFromVarName = React.useCallback((varName: string | undefined): string | null => {
    if (!varName || !projectId) return null;
    return variableCreationService.getIdByVarName(projectId, varName, undefined, getActiveFlowCanvasId());
  }, [projectId]);

  // ─────────────────────────────────────────────────────────
  // Config state must be declared before hooks that read `config` (Swagger / missing fields).
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
      ...(mockTableColumns !== undefined ? { mockTableColumns } : {}),
    };
    return cfg;
  }, []);

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

  React.useEffect(() => {
    if (!instanceId) return;
    const storedTask = taskRepository.getTask(instanceId);
    if (!storedTask) return;

    const loaded = buildConfigFromTask(storedTask);
    setConfig(loaded);
  }, [instanceId, buildConfigFromTask]);

  React.useEffect(() => {
    if (instanceId && config) {
      taskRepository.updateTask(
        instanceId,
        {
          endpoint: config.endpoint,
          inputs: config.inputs,
          outputs: config.outputs,
          ...(config.mockTable !== undefined ? { mockTable: config.mockTable } : {}),
          ...(config.mockTableColumns !== undefined ? { mockTableColumns: config.mockTableColumns } : {}),
        } as any,
        projectId
      );
    }
  }, [config, instanceId, projectId]);

  /** Datalist for "Campo API": filled after Read API from Swagger. */
  const availableApiParams = React.useMemo(() => {
    const merged = [...swaggerInputContract, ...swaggerOutputContract];
    return [...new Set(merged.map((x) => x.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [swaggerInputContract, swaggerOutputContract]);

  const missingInputApiNames = React.useMemo(() => {
    if (!swaggerInputContract.length) return [];
    const mapped = new Set(
      (config.inputs || [])
        .map((i) => (i.apiParam || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return swaggerInputContract.filter((n) => !mapped.has(n.trim().toLowerCase()));
  }, [swaggerInputContract, config.inputs]);

  const missingOutputApiNames = React.useMemo(() => {
    if (!swaggerOutputContract.length) return [];
    const mapped = new Set(
      (config.outputs || [])
        .map((o) => (o.apiField || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return swaggerOutputContract.filter((n) => !mapped.has(n.trim().toLowerCase()));
  }, [swaggerOutputContract, config.outputs]);

  const missingFieldsTotal = missingInputApiNames.length + missingOutputApiNames.length;

  const appendMissingParam = React.useCallback((zone: 'send' | 'receive', apiName: string) => {
    setConfig((prev) => {
      const used = collectUsedInternalNames(prev);
      const internal = nextUniqueInternalName(slugInternalName(apiName), used);
      if (zone === 'send') {
        return {
          ...prev,
          inputs: [...(prev.inputs || []), { internalName: internal, apiParam: apiName, variable: '' }],
        };
      }
      return {
        ...prev,
        outputs: [...(prev.outputs || []), { internalName: internal, apiField: apiName, variable: '' }],
      };
    });
  }, []);

  const handleReadApi = React.useCallback(async () => {
    const url = config.endpoint.url.trim();
    if (!url) return;
    setReadApiBusy(true);
    try {
      const { doc } = await fetchOpenApiDocument(url);
      const picked = pickOpenApiPathForReadApi(url, doc, config.endpoint.method);
      if ('error' in picked) {
        window.alert(picked.error);
        return;
      }
      const pathKey = picked.pathKey;
      const fields = extractOperationFields(doc, pathKey, config.endpoint.method);
      if (!fields) {
        window.alert(`Operazione ${config.endpoint.method} non trovata per ${pathKey}.`);
        return;
      }
      const inputNames = [...new Set([...fields.requestParamNames, ...fields.requestBodyPropertyNames])].filter(
        Boolean
      );
      const outputNames = fields.responsePropertyNames.filter(Boolean);
      setSwaggerInputContract(inputNames);
      setSwaggerOutputContract(outputNames);

      const inputsEmpty = !(config.inputs && config.inputs.length);
      const outputsEmpty = !(config.outputs && config.outputs.length);

      if (inputNames.length > 0 || outputNames.length > 0) {
        setConfig((prev) => {
          const used = new Set<string>();
          for (const i of prev.inputs || []) {
            const t = i.internalName?.trim();
            if (t) used.add(t);
          }
          for (const o of prev.outputs || []) {
            const t = o.internalName?.trim();
            if (t) used.add(t);
          }
          let nextInputs = prev.inputs || [];
          let nextOutputs = prev.outputs || [];
          if (inputsEmpty && inputNames.length > 0) {
            nextInputs = inputNames.map((apiName) => ({
              internalName: nextUniqueInternalName(slugInternalName(apiName), used),
              apiParam: apiName,
              variable: '',
            }));
          }
          if (outputsEmpty && outputNames.length > 0) {
            nextOutputs = outputNames.map((apiName) => ({
              internalName: nextUniqueInternalName(slugInternalName(apiName), used),
              apiField: apiName,
              variable: '',
            }));
          }
          return { ...prev, inputs: nextInputs, outputs: nextOutputs };
        });
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setReadApiBusy(false);
    }
  }, [config.endpoint.url, config.endpoint.method, config.inputs, config.outputs]);

  const handleTestApi = React.useCallback(async () => {
    const url = config.endpoint.url.trim();
    if (!url) return;
    setTestApiBusy(true);
    try {
      const method = config.endpoint.method;
      const init: RequestInit = {
        method,
        credentials: 'omit',
        headers: { ...(config.endpoint.headers || {}) },
      };
      if (method !== 'GET' && method !== 'HEAD') {
        const h = init.headers as Record<string, string>;
        h['Content-Type'] = h['Content-Type'] || 'application/json';
        init.body = '{}';
      }
      const res = await fetch(url, init);
      const text = await res.text();
      const preview = text.length > 3500 ? `${text.slice(0, 3500)}…` : text;
      window.alert(`HTTP ${res.status} ${res.statusText}\n\n${preview}`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setTestApiBusy(false);
    }
  }, [config.endpoint]);

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
      try {
        const nv = variableCreationService.createManualVariable(variableStoreProjectId, t);
        setVariablesRefreshKey((k) => k + 1);
        return nv.id;
      } catch {
        return '';
      }
    },
    [getVarIdFromVarName, variableStoreProjectId]
  );

  /** SEND: only link existing variables — never create new ids when saving. */
  const resolveVarIdForInputMapping = React.useCallback(
    (linkedName: string): string => {
      const t = linkedName.trim();
      if (!t) return '';
      return getVarIdFromVarName(t) ?? '';
    },
    [getVarIdFromVarName]
  );

  const mappingSend = React.useMemo(
    () => backendInputsToMappingEntries(config.inputs, getVarNameFromVarId),
    [config.inputs, getVarNameFromVarId]
  );

  const mappingReceive = React.useMemo(
    () => backendOutputsToMappingEntries(config.outputs, getVarNameFromVarId),
    [config.outputs, getVarNameFromVarId]
  );

  type MappingEntriesUpdater = MappingEntry[] | ((prev: MappingEntry[]) => MappingEntry[]);

  const handleBackendSendChange = React.useCallback(
    (entriesOrUpdater: MappingEntriesUpdater) => {
      setConfig((prev) => {
        const currentMapping = backendInputsToMappingEntries(prev.inputs, getVarNameFromVarId);
        const nextEntries =
          typeof entriesOrUpdater === 'function' ? entriesOrUpdater(currentMapping) : entriesOrUpdater;
        return {
          ...prev,
          inputs: mappingEntriesToBackendInputs(nextEntries, resolveVarIdForInputMapping),
        };
      });
    },
    [getVarNameFromVarId, resolveVarIdForInputMapping]
  );

  const handleBackendReceiveChange = React.useCallback(
    (entriesOrUpdater: MappingEntriesUpdater) => {
      setConfig((prev) => {
        const currentMapping = backendOutputsToMappingEntries(prev.outputs, getVarNameFromVarId);
        const nextEntries =
          typeof entriesOrUpdater === 'function' ? entriesOrUpdater(currentMapping) : entriesOrUpdater;
        return {
          ...prev,
          outputs: mappingEntriesToBackendOutputs(nextEntries, resolveVarIdForLinkedName),
        };
      });
    },
    [getVarNameFromVarId, resolveVarIdForLinkedName]
  );

  const handleCreateOutputVariable = React.useCallback(
    (displayName: string): { id: string; label: string } | null => {
      const t = displayName.trim();
      if (!t) return null;
      try {
        const nv = variableCreationService.createManualVariable(variableStoreProjectId, t);
        return { id: nv.id, label: nv.varName };
      } catch {
        return null;
      }
    },
    [variableStoreProjectId]
  );

  const handleOutputVariableCreated = React.useCallback(() => {
    setVariablesRefreshKey((k) => k + 1);
  }, []);

  const missingFieldsDropdownItems = React.useMemo(
    () => [
      ...missingInputApiNames.map((n) => ({
        label: `SEND · ${n}`,
        onClick: () => appendMissingParam('send', n),
      })),
      ...missingOutputApiNames.map((n) => ({
        label: `RECEIVE · ${n}`,
        onClick: () => appendMissingParam('receive', n),
      })),
    ],
    [missingInputApiNames, missingOutputApiNames, appendMissingParam]
  );

  const endpointUrlNonEmpty = Boolean(config.endpoint.url?.trim());

  // Toolbar buttons
  const toolbarButtons = React.useMemo<ToolbarButton[]>(() => {
    const readTestVisible = endpointUrlNonEmpty;
    const showMissing =
      readTestVisible &&
      missingFieldsTotal > 0 &&
      (swaggerInputContract.length > 0 || swaggerOutputContract.length > 0);

    return [
      {
        icon: showApiColumn ? <EyeOff size={16} /> : <Eye size={16} />,
        label: showApiColumn ? 'Hide API' : 'Show API',
        onClick: () => setShowApiColumn((prev) => !prev),
        title: showApiColumn ? 'Hide API parameter mapping column' : 'Show API parameter mapping column',
        active: showApiColumn,
      },
      {
        icon: <Table2 size={16} />,
        label: 'Mock Table',
        onClick: () => setShowTableView((prev) => !prev),
        title: showTableView ? 'Show mapping editor' : 'Show mock table',
        active: showTableView,
      },
      {
        icon: <BookOpen size={16} />,
        label: readApiBusy ? 'Reading…' : 'Read API',
        onClick: () => void handleReadApi(),
        title:
          'Scarica OpenAPI via server (no CORS): URL JSON, base API, o link Redoc con ?url=…. Se non indichi l’URL della singola chiamata, si usa #operation/id o #tag/nome se presenti nell’URL, altrimenti il primo path per il metodo scelto.',
        disabled: readApiBusy,
        visible: readTestVisible,
      },
      {
        icon: <FlaskConical size={16} />,
        label: testApiBusy ? 'Testing…' : 'Test API',
        onClick: () => void handleTestApi(),
        title: 'Chiamata di prova all’URL con il metodo selezionato (corpo JSON vuoto se non GET).',
        disabled: testApiBusy,
        visible: readTestVisible,
      },
      {
        icon: <ListPlus size={16} />,
        label: `Missing (${missingFieldsTotal})`,
        title: 'Campi definiti nello Swagger ma non ancora mappati: clic per aggiungere la riga in SEND o RECEIVE.',
        visible: showMissing,
        dropdownItems: missingFieldsDropdownItems,
      },
    ];
  }, [
    showApiColumn,
    showTableView,
    endpointUrlNonEmpty,
    readApiBusy,
    testApiBusy,
    handleReadApi,
    handleTestApi,
    missingFieldsTotal,
    swaggerInputContract.length,
    swaggerOutputContract.length,
    missingFieldsDropdownItems,
  ]);

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
  const setHeaderIcon = headerContext?.setIcon;
  const setHeaderTitle = headerContext?.setTitle;
  React.useEffect(() => {
    if (!setHeaderIcon || !setHeaderTitle) return;
    setHeaderIcon(<Server size={18} style={{ color: color || '#94a3b8' }} />);
    setHeaderTitle(String(task?.label || 'Backend Call'));

    return () => {
      setHeaderIcon(null);
      setHeaderTitle(null);
    };
  }, [setHeaderIcon, setHeaderTitle, task?.label, task?.type, color]);

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
                placeholder="https://api.example.com/v1/risorsa oppure …/v3/api-docs"
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
            onCreateOutputVariable={handleCreateOutputVariable}
            onOutputVariableCreated={handleOutputVariableCreated}
            resolveVariableRefIdFromLabel={(label) => getVarIdFromVarName(label) ?? undefined}
            showInterfacePalette={false}
            className="bg-slate-900"
            innerClassName="!p-2"
            flowDropTarget={
              getActiveFlowCanvasId() ? { flowCanvasId: getActiveFlowCanvasId()! } : undefined
            }
          />
        </div>
        )}
      </div>
    </div>
  );
}
