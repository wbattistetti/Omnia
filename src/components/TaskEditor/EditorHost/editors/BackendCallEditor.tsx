import React from 'react';
import { flushSync } from 'react-dom';
import type { EditorProps } from '../../EditorHost/types';
import { taskRepository } from '../../../../services/TaskRepository';
import { TaskType, type Task } from '../../../../types/taskTypes';
import { useProjectDataUpdate, useProjectData } from '../../../../context/ProjectDataContext';
import { useProjectTranslations } from '../../../../context/ProjectTranslationsContext';
import { useActiveFlowMetaTranslationsFlattened } from '../../../../hooks/useActiveFlowMetaTranslations';
import { getTaskVisualsByType } from '../../../../components/Flowchart/utils/taskVisuals';
import { useHeaderToolbarContext } from '../../ResponseEditor/context/HeaderToolbarContext';
import { Server, Eye, EyeOff, Table2, BookOpen, FlaskConical, ListPlus, RefreshCw } from 'lucide-react';
import { variableCreationService } from '../../../../services/VariableCreationService';
import { InterfaceMappingEditor } from '../../../../components/FlowMappingPanel/InterfaceMappingEditor';
import {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
  mappingEntriesToBackendInputs,
  mappingEntriesToBackendOutputs,
} from '../../../../components/FlowMappingPanel/backendCallMappingAdapter';
import type { MappingEntry } from '../../../../components/FlowMappingPanel/mappingTypes';
import { enrichBackendMappingEntriesOpenApi } from '../../../../components/FlowMappingPanel/enrichBackendMappingOpenApiUi';
import { getActiveFlowCanvasId } from '../../../../flows/activeFlowCanvas';
import { resolveVariableStoreProjectId } from '../../../../utils/safeProjectId';
import { getVariableLabel } from '../../../../utils/getVariableLabel';
import type { ToolbarButton } from '../../../../dock/types';
import { BackendCallMockTable } from './backendMockTable/BackendCallMockTable';
import { EndpointUrlMethodBar } from './EndpointUrlMethodBar';
import { BackendExecutionMode, type BackendMockTableRow } from '../../../../domain/backendTest/backendTestRowTypes';
import { buildLiteralFallbackFromSendMapping } from '../../../../domain/backendTest/buildLiteralFallbackFromSendMapping';
import {
  isBackendMockInputCellFilled,
  isBackendMockRowInputsFilledForColumns,
} from '../../../../domain/backendTest/backendMockRowCompletion';
import { slugInternalName, type OpenApiInputUiKind } from '../../../../services/openApiBackendCallSpec';
import { runBackendCallReadApiForTask } from '../../../../services/runBackendCallReadApiForTask';
import { logBackendCallTest } from '../../../../debug/backendCallTestDebug';

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
  /** URL documento OpenAPI: Read API lo usa solo se fallisce la discovery sull’endpoint operativo. */
  openapiSpecUrl?: string;
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
  // Mock table: array di righe con valori input/output (+ testRun opzionale)
  mockTable?: BackendMockTableRow[];
  /** Default MOCK/REAL per nuove righe e per righe senza override. */
  mockTableDefaultExecutionMode?: BackendExecutionMode;
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
  openapiSpecUrl: '',
  inputs: [],
  outputs: []
};

type MockTableColumnDef = { name: string; type: 'input' | 'output'; isActive: boolean };

type MockSigSlice = {
  inputs?: Array<{ internalName?: string }>;
  outputs?: Array<{ internalName?: string }>;
  mockTable?: BackendMockTableRow[];
  mockTableColumns?: MockTableColumnDef[];
};

/** Ricalcolo `mockTableColumns` dalla firma SEND/RECEIVE + colonne parked con dati legacy. */
function computeMockTableColumnsForSignature(prev: MockSigSlice): MockTableColumnDef[] {
  const currentInputs = prev.inputs || [];
  const currentOutputs = prev.outputs || [];
  const existingRows = prev.mockTable || [];
  const existingColumns = prev.mockTableColumns || [];

  const currentInputNames = new Set(currentInputs.map((inp) => inp.internalName).filter(Boolean));
  const currentOutputNames = new Set(currentOutputs.map((out) => out.internalName).filter(Boolean));

  const columnsByName = new Map<string, MockTableColumnDef>();
  for (const col of existingColumns) {
    columnsByName.set(col.name, col);
  }

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

  for (const inputName of currentInputNames) {
    if (columnsByName.has(inputName)) {
      const col = columnsByName.get(inputName)!;
      col.isActive = true;
      col.type = 'input';
    } else {
      columnsByName.set(inputName, { name: inputName, type: 'input', isActive: true });
    }
  }

  for (const outputName of currentOutputNames) {
    if (columnsByName.has(outputName)) {
      const col = columnsByName.get(outputName)!;
      col.isActive = true;
      col.type = 'output';
    } else {
      columnsByName.set(outputName, { name: outputName, type: 'output', isActive: true });
    }
  }

  for (const colName of allColumnNamesInRows) {
    if (!currentInputNames.has(colName) && !currentOutputNames.has(colName)) {
      if (columnsByName.has(colName)) {
        const col = columnsByName.get(colName)!;
        col.isActive = false;
      } else {
        const isInInputs = existingRows.some((row) => row.inputs && row.inputs[colName] !== undefined);
        const colType = isInInputs ? 'input' : 'output';
        columnsByName.set(colName, { name: colName, type: colType, isActive: false });
      }
    }
  }

  return Array.from(columnsByName.values());
}

/** Mantiene in ogni riga solo chiavi ancora presenti nelle colonne (input/output). */
function mergeMockTableRowsToColumns(
  rows: BackendMockTableRow[],
  columns: MockTableColumnDef[]
): BackendMockTableRow[] {
  const validIn = new Set(columns.filter((c) => c.type === 'input').map((c) => c.name));
  const validOut = new Set(columns.filter((c) => c.type === 'output').map((c) => c.name));
  return rows.map((row) => {
    const ni: Record<string, unknown> = {};
    for (const k of validIn) {
      if (row.inputs && Object.prototype.hasOwnProperty.call(row.inputs, k)) {
        ni[k] = row.inputs[k];
      }
    }
    const no: Record<string, unknown> = {};
    for (const k of validOut) {
      if (row.outputs && Object.prototype.hasOwnProperty.call(row.outputs, k)) {
        no[k] = row.outputs[k];
      }
    }
    return { ...row, inputs: ni, outputs: no };
  });
}

export default function BackendCallEditor({
  task,
  onToolbarUpdate,
  hideHeader,
  hideEndpointRow,
  endpointExternalRevision,
}: EditorProps) {
  // ✅ RINOMINATO: act → task
  const instanceId = task.instanceId || task.id; // ✅ RINOMINATO: act → task
  const pdUpdate = useProjectDataUpdate();
  const { data: projectData } = useProjectData();
  useProjectTranslations();
  const activeFlowTranslations = useActiveFlowMetaTranslationsFlattened();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;
  const variableStoreProjectId = React.useMemo(
    () => resolveVariableStoreProjectId(projectId),
    [projectId, projectData]
  );

  // ✅ State to force re-render of availableVariables when a new variable is created
  const [variablesRefreshKey, setVariablesRefreshKey] = React.useState(0);

  /** Snapshot testi OpenAPI dopo ultimo Read API (persistito anche su `backendCallSpecMeta`). */
  const [openapiDescriptionSnapshots, setOpenapiDescriptionSnapshots] = React.useState<{
    inputs: Record<string, string>;
    outputs: Record<string, string>;
  } | null>(null);

  React.useEffect(() => {
    if (!instanceId) {
      setOpenapiDescriptionSnapshots(null);
      return;
    }
    const t = taskRepository.getTask(instanceId) as
      | { backendCallSpecMeta?: { openapiDescriptionSnapshots?: { inputs: Record<string, string>; outputs: Record<string, string> } } }
      | null;
    const snap = t?.backendCallSpecMeta?.openapiDescriptionSnapshots;
    setOpenapiDescriptionSnapshots(snap ?? null);
  }, [instanceId]);

  // Show/hide API column (tree: Campo API inputs)
  const [showApiColumn, setShowApiColumn] = React.useState(true);

  // Toggle between mapping view and table view
  const [showTableView, setShowTableView] = React.useState(false);

  /** Last successful Read API: expected field names from Swagger (for datalist + missing). */
  const [swaggerInputContract, setSwaggerInputContract] = React.useState<string[]>([]);
  const [swaggerOutputContract, setSwaggerOutputContract] = React.useState<string[]>([]);
  const [readApiBusy, setReadApiBusy] = React.useState(false);
  const [bulkApiTestBusy, setBulkApiTestBusy] = React.useState(false);
  const [bulkTestNonce, setBulkTestNonce] = React.useState(0);

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

  /** Euristica variabile (GUID noto) vs valore costante su `inputs[].variable` / `outputs[].variable`. */
  const knownBackendVariableIdSet = React.useMemo(
    () => new Set(availableVariables),
    [availableVariables]
  );

  // ─────────────────────────────────────────────────────────
  // Config state must be declared before hooks that read `config` (Swagger / missing fields).
  // ─────────────────────────────────────────────────────────
  const buildConfigFromTask = React.useCallback((rawTask: any): BackendCallConfig => {
    const endpoint = rawTask?.endpoint ?? DEFAULT_CONFIG.endpoint;
    const rawIn = Array.isArray(rawTask?.inputs) ? rawTask.inputs : [];
    const rawOut = Array.isArray(rawTask?.outputs) ? rawTask.outputs : [];
    let inputs: BackendCallConfig['inputs'] = rawIn.filter((i: { internalName?: string }) => Boolean(i?.internalName?.trim()));
    const outputs: BackendCallConfig['outputs'] = rawOut.filter((o: { internalName?: string }) =>
      Boolean(o?.internalName?.trim())
    );

    const epInv = (rawTask as { endpointInvocationValues?: Record<string, string> }).endpointInvocationValues;
    if (epInv && typeof epInv === 'object') {
      inputs = inputs.map((inp) => {
        const name = inp.internalName?.trim();
        if (!name) return inp;
        const mig = epInv[name];
        if (mig === undefined || mig === null) return inp;
        const m = String(mig).trim();
        if (!m) return inp;
        if (String(inp.variable ?? '').trim()) return inp;
        return { ...inp, variable: m };
      });
    }
    const mockTable = rawTask?.mockTable as BackendCallConfig['mockTable'] | undefined;
    const mockTableColumns: BackendCallConfig['mockTableColumns'] = rawTask?.mockTableColumns;
    const mockTableDefaultExecutionMode = (rawTask as { mockTableDefaultExecutionMode?: BackendExecutionMode })
      ?.mockTableDefaultExecutionMode;
    const openapiSpecUrl =
      typeof (rawTask as { openapiSpecUrl?: string }).openapiSpecUrl === 'string'
        ? (rawTask as { openapiSpecUrl: string }).openapiSpecUrl
        : '';

    const cfg: BackendCallConfig = {
      endpoint,
      openapiSpecUrl,
      inputs,
      outputs,
      ...(mockTable !== undefined ? { mockTable } : {}),
      ...(mockTableColumns !== undefined ? { mockTableColumns } : {}),
      ...(mockTableDefaultExecutionMode !== undefined ? { mockTableDefaultExecutionMode } : {}),
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
          openapiSpecUrl: '',
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

  const [backendToolDescription, setBackendToolDescription] = React.useState(() => {
    if (!instanceId) return '';
    const st = taskRepository.getTask(instanceId);
    return String((st as Task)?.backendToolDescription ?? '');
  });

  React.useEffect(() => {
    if (!instanceId) return;
    const storedTask = taskRepository.getTask(instanceId);
    if (!storedTask) return;

    const loaded = buildConfigFromTask(storedTask);
    setConfig(loaded);
    setBackendToolDescription(String((storedTask as Task).backendToolDescription ?? ''));
  }, [instanceId, buildConfigFromTask, endpointExternalRevision]);

  React.useEffect(() => {
    if (instanceId && config) {
      taskRepository.updateTask(
        instanceId,
        {
          endpoint: config.endpoint,
          openapiSpecUrl: config.openapiSpecUrl ?? '',
          inputs: config.inputs,
          outputs: config.outputs,
          ...(config.mockTable !== undefined ? { mockTable: config.mockTable } : {}),
          ...(config.mockTableColumns !== undefined ? { mockTableColumns: config.mockTableColumns } : {}),
          ...(config.mockTableDefaultExecutionMode !== undefined
            ? { mockTableDefaultExecutionMode: config.mockTableDefaultExecutionMode }
            : {}),
          endpointInvocationValues: undefined,
          backendToolDescription,
        } as any,
        projectId
      );
    }
  }, [config, backendToolDescription, instanceId, projectId]);

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
    if (!instanceId) return;
    const op = config.endpoint.url.trim();
    const spec = (config.openapiSpecUrl || '').trim();
    if (!op && !spec) {
      window.alert('Inserire endpoint operativo o Spec URL (OpenAPI).');
      return;
    }
    setReadApiBusy(true);
    try {
      const result = await runBackendCallReadApiForTask(instanceId, projectId, op, config.endpoint.method, {
        openapiSpecUrl: spec || undefined,
      });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setSwaggerInputContract(result.inputNames);
      setSwaggerOutputContract(result.outputNames);
      setOpenapiDescriptionSnapshots({
        inputs: { ...result.inputDescriptionsByApiName },
        outputs: { ...result.outputDescriptionsByApiName },
      });
      const storedTask = taskRepository.getTask(instanceId);
      if (storedTask) {
        setConfig(buildConfigFromTask(storedTask));
        setBackendToolDescription(String((storedTask as Task).backendToolDescription ?? ''));
      }
    } finally {
      setReadApiBusy(false);
    }
  }, [
    buildConfigFromTask,
    config.endpoint.method,
    config.endpoint.url,
    config.openapiSpecUrl,
    instanceId,
    projectId,
  ]);

  const updateMockTableColumns = React.useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      mockTableColumns: computeMockTableColumnsForSignature(prev),
    }));
  }, []);

  const refreshMockTableStructure = React.useCallback(() => {
    setConfig((prev) => {
      const updatedColumns = computeMockTableColumnsForSignature(prev);
      const mergedRows = mergeMockTableRowsToColumns(prev.mockTable || [], updatedColumns);
      return {
        ...prev,
        mockTableColumns: updatedColumns,
        mockTable: mergedRows,
      };
    });
  }, []);

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

  const mappingSend = React.useMemo(
    () =>
      enrichBackendMappingEntriesOpenApi(
        backendInputsToMappingEntries(config.inputs, knownBackendVariableIdSet),
        'send',
        openapiDescriptionSnapshots
      ),
    [config.inputs, knownBackendVariableIdSet, openapiDescriptionSnapshots]
  );

  const mappingReceive = React.useMemo(
    () =>
      enrichBackendMappingEntriesOpenApi(
        backendOutputsToMappingEntries(config.outputs, knownBackendVariableIdSet),
        'receive',
        openapiDescriptionSnapshots
      ),
    [config.outputs, knownBackendVariableIdSet, openapiDescriptionSnapshots]
  );

  /** Fallback Test API: solo letterali SEND (variabile di flusso → valorizza la cella mock o runtime). */
  const literalFallbackFromSend = React.useMemo(
    () => buildLiteralFallbackFromSendMapping(mappingSend),
    [mappingSend]
  );

  type MappingEntriesUpdater = MappingEntry[] | ((prev: MappingEntry[]) => MappingEntry[]);

  const handleBackendSendChange = React.useCallback(
    (entriesOrUpdater: MappingEntriesUpdater) => {
      setConfig((prev) => {
        const currentMapping = backendInputsToMappingEntries(prev.inputs, knownBackendVariableIdSet);
        const nextEntries =
          typeof entriesOrUpdater === 'function' ? entriesOrUpdater(currentMapping) : entriesOrUpdater;
        return {
          ...prev,
          inputs: mappingEntriesToBackendInputs(nextEntries),
        };
      });
    },
    [knownBackendVariableIdSet]
  );

  const handleBackendReceiveChange = React.useCallback(
    (entriesOrUpdater: MappingEntriesUpdater) => {
      setConfig((prev) => {
        const currentMapping = backendOutputsToMappingEntries(prev.outputs, knownBackendVariableIdSet);
        const nextEntries =
          typeof entriesOrUpdater === 'function' ? entriesOrUpdater(currentMapping) : entriesOrUpdater;
        return {
          ...prev,
          outputs: mappingEntriesToBackendOutputs(nextEntries),
        };
      });
    },
    [knownBackendVariableIdSet]
  );

  const handleCreateOutputVariable = React.useCallback(
    (displayName: string): { id: string; label: string } | null => {
      const t = displayName.trim();
      if (!t) return null;
      try {
        const nv = variableCreationService.createManualVariable(variableStoreProjectId, t);
        return { id: nv.id, label: t };
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

  const operationalUrlNonEmpty = Boolean(config.endpoint.url?.trim());
  const openapiSpecUrlNonEmpty = Boolean((config.openapiSpecUrl || '').trim());
  const readApiToolbarVisible = operationalUrlNonEmpty || openapiSpecUrlNonEmpty;
  const mockTableActiveInputInternalNames = React.useMemo(() => {
    const cols = config.mockTableColumns;
    if (cols?.length) {
      return cols.filter((c) => c.type === 'input' && c.isActive).map((c) => c.name).filter(Boolean);
    }
    return (config.inputs || []).map((i) => i.internalName?.trim()).filter(Boolean) as string[];
  }, [config.mockTableColumns, config.inputs]);

  /**
   * Test API: tutti gli input SEND sono valorizzati dalla striscia endpoint oppure (fallback) da almeno una riga mock completa.
   */
  const mockTableHasAtLeastOneCompleteRow = React.useMemo(() => {
    const table = config.mockTable ?? [];
    const names = mockTableActiveInputInternalNames;
    if (names.length === 0) {
      return false;
    }
    const fallback = literalFallbackFromSend;
    if (names.every((n) => isBackendMockInputCellFilled(fallback[n]))) {
      return true;
    }
    return table.some((row) => isBackendMockRowInputsFilledForColumns(row, names, fallback));
  }, [config.mockTable, mockTableActiveInputInternalNames, literalFallbackFromSend]);

  const [highlightIncompleteRows, setHighlightIncompleteRows] = React.useState(false);

  React.useEffect(() => {
    if (mockTableHasAtLeastOneCompleteRow) setHighlightIncompleteRows(false);
  }, [mockTableHasAtLeastOneCompleteRow]);

  const testApiReadiness = React.useMemo(() => {
    if (mockTableActiveInputInternalNames.length === 0) return 'needs_setup' as const;
    if (mockTableHasAtLeastOneCompleteRow) return 'ready' as const;
    return 'incomplete' as const;
  }, [mockTableActiveInputInternalNames.length, mockTableHasAtLeastOneCompleteRow]);

  const handleTestApi = React.useCallback(() => {
    logBackendCallTest('handleTestApi: click', { testApiReadiness });
    setShowTableView(true);
    if (testApiReadiness === 'needs_setup') {
      logBackendCallTest('handleTestApi: stop (needs_setup — nessun input attivo in tabella)');
      return;
    }
    if (testApiReadiness === 'incomplete') {
      logBackendCallTest('handleTestApi: evidenzia righe incomplete, bulk non avviato');
      setHighlightIncompleteRows(true);
      return;
    }
    setHighlightIncompleteRows(false);
    flushSync(() => {
      setConfig((prev) => {
        const names =
          (prev.mockTableColumns?.length
            ? prev.mockTableColumns.filter((c) => c.type === 'input' && c.isActive).map((c) => c.name)
            : (prev.inputs || []).map((i) => i.internalName?.trim()).filter(Boolean)) ?? [];
        const fb = buildLiteralFallbackFromSendMapping(
          enrichBackendMappingEntriesOpenApi(
            backendInputsToMappingEntries(prev.inputs, knownBackendVariableIdSet),
            'send',
            openapiDescriptionSnapshots
          )
        );
        const stripComplete =
          names.length > 0 && names.every((n) => isBackendMockInputCellFilled(fb[String(n)]));
        if (stripComplete && (prev.mockTable?.length ?? 0) === 0) {
          const nextTable = [
            {
              id: `row_${Date.now()}`,
              inputs: {},
              outputs: {},
              testRun: {
                executionMode: prev.mockTableDefaultExecutionMode ?? BackendExecutionMode.MOCK,
                notes: {},
              },
            },
          ] as BackendMockTableRow[];
          return {
            ...prev,
            mockTable: nextTable,
            mockTableColumns: computeMockTableColumnsForSignature({ ...prev, mockTable: nextTable }),
          };
        }
        return prev;
      });
    });
    setBulkTestNonce((n) => {
      const next = n + 1;
      logBackendCallTest('handleTestApi: avvio bulk mock table', { bulkTestNonce: { from: n, to: next } });
      return next;
    });
  }, [testApiReadiness, knownBackendVariableIdSet, openapiDescriptionSnapshots]);

  /** Tooltip celle: descrizione parametro + «. Clicca per editare.» */
  const inputTooltipByInternalName = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const inp of config.inputs || []) {
      const internal = inp.internalName?.trim();
      if (!internal) continue;
      const api = inp.apiParam?.trim();
      const local = inp.fieldDescription?.trim();
      const snap = api ? openapiDescriptionSnapshots?.inputs?.[api]?.trim() : undefined;
      const desc = local || snap || '';
      out[internal] = desc ? `${desc}. Clicca per editare.` : 'Clicca per editare.';
    }
    return out;
  }, [config.inputs, openapiDescriptionSnapshots]);

  const outputValueTooltipByInternalName = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const o of config.outputs || []) {
      const internal = o.internalName?.trim();
      if (!internal) continue;
      const api = o.apiField?.trim();
      const local = o.fieldDescription?.trim();
      const snap = api ? openapiDescriptionSnapshots?.outputs?.[api]?.trim() : undefined;
      const desc = local || snap || '';
      out[internal] = desc ? `${desc}. Clicca per editare.` : 'Clicca per editare.';
    }
    return out;
  }, [config.outputs, openapiDescriptionSnapshots]);

  const inputUiKindByInternalName = React.useMemo(() => {
    const st = instanceId ? (taskRepository.getTask(instanceId) as Task | null) : null;
    const meta = st?.backendCallSpecMeta as { openapiInputUiKindByApiName?: Record<string, string> } | undefined;
    const byApi = meta?.openapiInputUiKindByApiName;
    if (!byApi || typeof byApi !== 'object') return {} as Record<string, OpenApiInputUiKind>;
    const out: Record<string, OpenApiInputUiKind> = {};
    for (const inp of config.inputs || []) {
      const internal = inp.internalName?.trim();
      const api = inp.apiParam?.trim();
      if (!internal || !api) continue;
      const raw = byApi[api];
      if (raw === 'number' || raw === 'date' || raw === 'time' || raw === 'datetime-local' || raw === 'text') {
        out[internal] = raw;
      }
    }
    return out;
  }, [instanceId, config.inputs, openapiDescriptionSnapshots]);

  const labelStyle = React.useMemo(
    () => ({ fontFamily: 'var(--ds-font-field-label, inherit)' } as React.CSSProperties),
    []
  );
  const controlStyle = React.useMemo(
    () => ({ fontFamily: 'var(--ds-font-control, inherit)' } as React.CSSProperties),
    []
  );

  const mockExecMode = config.mockTableDefaultExecutionMode ?? BackendExecutionMode.MOCK;

  // Toolbar buttons
  const toolbarButtons = React.useMemo<ToolbarButton[]>(() => {
    const showMissing =
      readApiToolbarVisible &&
      missingFieldsTotal > 0 &&
      (swaggerInputContract.length > 0 || swaggerOutputContract.length > 0);

    const testApiTitle =
      testApiReadiness === 'needs_setup'
        ? 'Clicca per impostare il set di test'
        : testApiReadiness === 'incomplete'
          ? 'Completa tutti gli input attivi su almeno una riga: il test gira solo sulle righe complete; le righe vuote vengono saltate.'
          : 'Chiamata HTTP reale al backend (proxy ApiServer) per ogni riga con tutti gli input compilati; le righe vuote sono saltate. Il toggle MOCK/REAL non influisce su Test API — MOCK serve per emulare i valori nelle celle output senza rete.';

    const base: ToolbarButton[] = [
      {
        label: mockExecMode === BackendExecutionMode.MOCK ? 'MOCK' : 'REAL',
        onClick: () =>
          setConfig((prev) => ({
            ...prev,
            mockTableDefaultExecutionMode:
              (prev.mockTableDefaultExecutionMode ?? BackendExecutionMode.MOCK) === BackendExecutionMode.MOCK
                ? BackendExecutionMode.REAL
                : BackendExecutionMode.MOCK,
          })),
        title:
          mockExecMode === BackendExecutionMode.MOCK
            ? 'Modalità MOCK: emula il backend con i valori che scrivi nelle celle output (nessuna HTTP da qui). «Test API» chiama comunque il backend via proxy. Clicca per passare a REAL.'
            : 'Modalità REAL: preferenza predefinita per nuove righe (HTTP via proxy se usassi esecuzione per riga). «Test API» è sempre HTTP. Clicca per passare a MOCK.',
        active: mockExecMode === BackendExecutionMode.REAL,
        visible: operationalUrlNonEmpty,
      },
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
          'Scarica OpenAPI via ApiServer (no CORS): prima discovery dall’endpoint operativo; se fallisce, usa lo Spec URL se compilato. Path operazione da URL (hash/query) o primo path per il metodo.',
        disabled: readApiBusy,
        visible: readApiToolbarVisible,
      },
      {
        icon: <FlaskConical size={16} />,
        label: bulkApiTestBusy ? 'Testing…' : 'Test API',
        onClick: () => void handleTestApi(),
        title: testApiTitle,
        disabled: bulkApiTestBusy,
        successHighlight: testApiReadiness === 'ready' && !bulkApiTestBusy,
        visible: operationalUrlNonEmpty,
      },
    ];

    if (showMissing) {
      base.push({
        icon: <ListPlus size={16} />,
        label: `Missing (${missingFieldsTotal})`,
        title: 'Campi definiti nello Swagger ma non ancora mappati: clic per aggiungere la riga in SEND o RECEIVE.',
        visible: true,
        dropdownItems: missingFieldsDropdownItems,
      });
    }

    if (showTableView && operationalUrlNonEmpty) {
      base.push({
        icon: <RefreshCw size={16} />,
        label: 'Refresh',
        onClick: () => refreshMockTableStructure(),
        title:
          'Ricalcola colonne dalla firma SEND/RECEIVE attuale (es. dopo Read API o modifiche mapping). I valori nelle celle ancora valide vengono conservati.',
        visible: true,
      });
    }

    return base;
  }, [
    showApiColumn,
    showTableView,
    readApiToolbarVisible,
    operationalUrlNonEmpty,
    readApiBusy,
    bulkApiTestBusy,
    handleReadApi,
    handleTestApi,
    missingFieldsTotal,
    swaggerInputContract.length,
    swaggerOutputContract.length,
    missingFieldsDropdownItems,
    testApiReadiness,
    mockExecMode,
    refreshMockTableStructure,
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

      <div
        className={
          hideEndpointRow
            ? 'flex-1 min-h-0 overflow-auto px-0 py-0'
            : 'flex-1 min-h-0 overflow-auto p-3'
        }
      >
        {!hideEndpointRow && (
          <div className="mb-3 space-y-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                style={labelStyle}
              >
                Endpoint operativo
              </label>
              <EndpointUrlMethodBar
                url={config.endpoint.url}
                method={config.endpoint.method}
                onUrlChange={(next) => updateEndpoint({ url: next })}
                onMethodChange={(next) => updateEndpoint({ method: next as BackendCallConfig['endpoint']['method'] })}
                placeholder="https://api.example.com/… — discovery /openapi.json, /swagger.json, … sulla stessa origine"
                controlStyle={controlStyle}
                labelStyle={labelStyle}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                style={labelStyle}
              >
                Spec URL (OpenAPI, fallback)
              </label>
              <input
                type="text"
                style={controlStyle}
                value={config.openapiSpecUrl ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, openapiSpecUrl: e.target.value }))}
                placeholder="Usato solo se la discovery dall’endpoint operativo fallisce (es. …/v3/api-docs)"
                className="w-full min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Two Column Layout: Input (left) + Output (right) OR Table View */}
        {showTableView ? (
          <>
            <BackendCallMockTable
              bulkTestNonce={bulkTestNonce}
              endpointInvocationFallback={literalFallbackFromSend}
              onBulkTestStart={() => setBulkApiTestBusy(true)}
              onBulkTestEnd={() => setBulkApiTestBusy(false)}
              highlightIncompleteRows={highlightIncompleteRows}
              inputTooltipByInternalName={inputTooltipByInternalName}
              outputValueTooltipByInternalName={outputValueTooltipByInternalName}
              inputUiKindByInternalName={inputUiKindByInternalName}
              inputs={(config.inputs || []).map((input) => {
                const v = input.variable?.trim();
                const displayVar =
                  v && knownBackendVariableIdSet.has(v)
                    ? getVariableLabel(v, activeFlowTranslations) || undefined
                    : v || undefined;
                return { ...input, variable: displayVar };
              })}
              outputs={(config.outputs || []).map((output) => {
                const v = output.variable?.trim();
                const displayVar =
                  v && knownBackendVariableIdSet.has(v)
                    ? getVariableLabel(v, activeFlowTranslations) || undefined
                    : v || undefined;
                return { ...output, variable: displayVar };
              })}
              rows={(config.mockTable || []) as BackendMockTableRow[]}
              columns={config.mockTableColumns}
              onMockTableRecipe={(recipe) => {
                setConfig((prev) => ({
                  ...prev,
                  mockTable: recipe((prev.mockTable || []) as BackendMockTableRow[]),
                }));
              }}
              onColumnsChange={(columns) => setConfig((prev) => ({ ...prev, mockTableColumns: columns }))}
              mappingSend={mappingSend}
              endpoint={config.endpoint}
              defaultExecutionMode={
                config.mockTableDefaultExecutionMode ?? BackendExecutionMode.MOCK
              }
              variableLabelByColumn={(internalName, zone) => {
                const list = zone === 'input' ? config.inputs || [] : config.outputs || [];
                const row = list.find((x) => x.internalName === internalName);
                const v = row?.variable?.trim();
                if (!v) return undefined;
                if (knownBackendVariableIdSet.has(v)) {
                  return getVariableLabel(v, activeFlowTranslations) || v;
                }
                return v;
              }}
            />
          </>
        ) : (
        <div className="flex-1 min-h-[320px] min-w-0 flex flex-col min-h-0">
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
            backendKnownVariableIds={knownBackendVariableIdSet}
            apiOptions={availableApiParams}
            variableOptions={availableVariables}
            showApiFields={showApiColumn}
            onCreateOutputVariable={handleCreateOutputVariable}
            onOutputVariableCreated={handleOutputVariableCreated}
            showInterfacePalette={false}
            compactBackendPanels
            className="bg-transparent"
            flowDropTarget={
              getActiveFlowCanvasId() ? { flowCanvasId: getActiveFlowCanvasId()! } : undefined
            }
            backendSendParamKindByWireKey={inputUiKindByInternalName}
          />
        </div>
        )}
      </div>
    </div>
  );
}
