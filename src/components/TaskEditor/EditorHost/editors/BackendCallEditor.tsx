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
import {
  Server,
  Eye,
  EyeOff,
  Table2,
  BookOpen,
  FlaskConical,
  ListPlus,
  RefreshCw,
  Columns2,
  Calculator,
} from 'lucide-react';
import { variableCreationService } from '../../../../services/VariableCreationService';
import { InterfaceMappingEditor } from '../../../../components/FlowMappingPanel/InterfaceMappingEditor';
import {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
  mappingEntriesToBackendInputs,
  mappingEntriesToBackendOutputs,
} from '../../../../components/FlowMappingPanel/backendCallMappingAdapter';
import { wrapBookFromAgendaSessionEntries } from '../../../../components/FlowMappingPanel/bookFromAgendaSessionTree';
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
import { ensureMockTablePrefilledFromSendLiterals } from '../../../../domain/backendTest/ensureMockTablePrefilledFromSendLiterals';
import {
  isBackendMockRowAnyInputFilled,
} from '../../../../domain/backendTest/backendMockRowCompletion';
import { slugInternalName, type OpenApiInputUiKind } from '../../../../services/openApiBackendCallSpec';
import { runBackendCallReadApiForTask } from '../../../../services/runBackendCallReadApiForTask';
import { resolvePortalConnectionIdForUrl } from '@domain/portalAuth/resolvePortalConnectionId';
import { ConnectPortalModal } from '@components/portalAuth/ConnectPortalModal';
import { upsertProjectPortalConnection } from '@domain/portalAuth/projectPortalConnections';
import type { PortalConnectionMeta } from '@domain/portalAuth/portalConnectionTypes';
import { logBackendCallTest } from '../../../../debug/backendCallTestDebug';
import type {
  BackendInputAdvancementEntry,
  BackendRecalculationEntry,
} from '../../../../domain/advancement/backendAdvancementConfig';
import type { AdvancementValueType } from '../../../../domain/advancement/advancementDsl';
import { BackendRecalculationEditor, SendParamAdvancementFullEditor } from './backendAdvancement/SendParamAdvancementFullEditor';
import {
  buildAdvancementContextChips,
  buildFullParamRecordFromSendMapping,
  buildParamRecordFromSendMapping,
  buildUnifiedRecalculationBeforeAfterRows,
  paramFieldKeyFromWireKey,
  runAdvancementPlayEvaluation,
  runUnifiedBackendAdvancementPlayEvaluation,
  sendRowValueFingerprint,
  type AdvancementQuickTestRowState,
} from '../../../../domain/advancement/advancementQuickTest';

function defaultAdvancementEntry(): BackendInputAdvancementEntry {
  return { enabled: false, dslExpression: '', naturalLanguage: '' };
}

/** WireKey sintetico per editor di ricalcolo unificato (tutti i SEND). */
const BACKEND_RECALC_WIRE_KEY = '__backend__';

function defaultBackendRecalculationEntry(): BackendRecalculationEntry {
  return { dslExpression: '', naturalLanguage: '' };
}

const SEND_RECV_SPLIT_STORAGE_KEY = 'omnia.backendCall.sendReceiveSplitRatio';

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
  /** OAuth PortalConnection per API dietro login. */
  portalConnectionId?: string;
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
    /** Da Read API + `x-omnia.sendBinding`. */
    sendBindingOptional?: boolean;
    sendBindingDesignTimeRequired?: boolean;
    sendConstraintGroupId?: string;
    sendConstraintGroupLabel?: string;
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
  /** Batch progression: executable DSL per SEND parameter (Omnia runtime). */
  inputAdvancement?: Record<string, BackendInputAdvancementEntry>;
  inputAdvancementTypes?: Record<string, AdvancementValueType>;
  /**
   * Un solo script di avanzamento/ricalcolo per l’intera chiamata (sostituisce la UI per-parametro).
   * Se presente con contenuto, ha priorità concettuale su `inputAdvancement` legacy.
   */
  backendAdvancement?: BackendRecalculationEntry;
}

const DEFAULT_CONFIG: BackendCallConfig = {
  endpoint: {
    url: '',
    method: 'GET',
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
  /** Errore Read API / validazione: inline sotto URL/metodo (no alert). */
  const [readApiError, setReadApiError] = React.useState<string | null>(null);
  const [bulkApiTestBusy, setBulkApiTestBusy] = React.useState(false);
  const [bulkTestNonce, setBulkTestNonce] = React.useState(0);

  /** WireKey SEND con editor avanzamento a pannello intero aperto. */
  const [advancementEditorWireKey, setAdvancementEditorWireKey] = React.useState<string | null>(null);

  /** Chip contesto test rapido per riga SEND (condivisi tra riga collassata e overlay). */
  const [advancementQuickTestUi, setAdvancementQuickTestUi] = React.useState<
    Record<string, AdvancementQuickTestRowState | undefined>
  >({});
  const prevAdvancementOverlayWireKeyRef = React.useRef<string | null>(null);

  const [receiveMappingPanelVisible, setReceiveMappingPanelVisible] = React.useState(true);
  const [sendReceiveSplitRatio, setSendReceiveSplitRatio] = React.useState(() => {
    try {
      const s = typeof localStorage !== 'undefined' ? localStorage.getItem(SEND_RECV_SPLIT_STORAGE_KEY) : null;
      if (s == null) return 0.58;
      const n = Number(s);
      return Number.isFinite(n) ? Math.min(0.82, Math.max(0.28, n)) : 0.58;
    } catch {
      return 0.58;
    }
  });

  const persistSendReceiveSplitRatio = React.useCallback((r: number) => {
    const c = Math.min(0.82, Math.max(0.28, r));
    setSendReceiveSplitRatio(c);
    try {
      localStorage.setItem(SEND_RECV_SPLIT_STORAGE_KEY, String(c));
    } catch {
      /* noop */
    }
  }, []);

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
    const portalConnectionId =
      typeof (rawTask as { portalConnectionId?: string }).portalConnectionId === 'string'
        ? (rawTask as { portalConnectionId: string }).portalConnectionId.trim()
        : undefined;

    const adv = (rawTask as { inputAdvancement?: BackendCallConfig['inputAdvancement'] }).inputAdvancement;
    const advTypes = (rawTask as { inputAdvancementTypes?: BackendCallConfig['inputAdvancementTypes'] })
      .inputAdvancementTypes;
    let backendAdvancement = (rawTask as { backendAdvancement?: BackendRecalculationEntry }).backendAdvancement;
    if (
      (!backendAdvancement?.dslExpression || !String(backendAdvancement.dslExpression).trim()) &&
      adv &&
      typeof adv === 'object'
    ) {
      for (const k of Object.keys(adv)) {
        const e = adv[k];
        if (e?.enabled && String(e.dslExpression ?? '').trim()) {
          backendAdvancement = {
            dslExpression: e.dslExpression ?? '',
            naturalLanguage: e.naturalLanguage,
            naturalLanguageAlignedWithScript: e.naturalLanguageAlignedWithScript,
            dslManuallyEditedAfterAlign: e.dslManuallyEditedAfterAlign,
          };
          break;
        }
      }
    }
    const cfg: BackendCallConfig = {
      endpoint,
      openapiSpecUrl,
      ...(portalConnectionId ? { portalConnectionId } : {}),
      inputs,
      outputs,
      ...(mockTable !== undefined ? { mockTable } : {}),
      ...(mockTableColumns !== undefined ? { mockTableColumns } : {}),
      ...(mockTableDefaultExecutionMode !== undefined ? { mockTableDefaultExecutionMode } : {}),
      ...(adv && typeof adv === 'object' ? { inputAdvancement: adv } : {}),
      ...(advTypes && typeof advTypes === 'object' ? { inputAdvancementTypes: advTypes } : {}),
      ...(backendAdvancement && typeof backendAdvancement === 'object'
        ? { backendAdvancement }
        : {}),
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
    setReadApiError(null);
  }, [config.endpoint.url, config.endpoint.method, config.openapiSpecUrl]);

  const [portalConnectModal, setPortalConnectModal] = React.useState<{ open: boolean; origin: string }>({
    open: false,
    origin: '',
  });

  const mergePortalConnections = React.useCallback(
    (meta: PortalConnectionMeta) => {
      if (!projectData || !pdUpdate?.updateDataDirectly) return;
      const blob = upsertProjectPortalConnection(projectData, meta);
      pdUpdate.updateDataDirectly({ ...projectData, portalConnections: blob });
    },
    [projectData, pdUpdate]
  );

  const resolvePortalConnectionId = React.useCallback(() => {
    return resolvePortalConnectionIdForUrl(projectData ?? null, config.endpoint.url, {
      portalConnectionId: config.portalConnectionId,
    });
  }, [projectData, config.endpoint.url, config.portalConnectionId]);

  React.useEffect(() => {
    if (instanceId && config) {
      taskRepository.updateTask(
        instanceId,
        {
          endpoint: config.endpoint,
          openapiSpecUrl: config.openapiSpecUrl ?? '',
          ...(config.portalConnectionId ? { portalConnectionId: config.portalConnectionId } : {}),
          inputs: config.inputs,
          outputs: config.outputs,
          ...(config.mockTable !== undefined ? { mockTable: config.mockTable } : {}),
          ...(config.mockTableColumns !== undefined ? { mockTableColumns: config.mockTableColumns } : {}),
          ...(config.mockTableDefaultExecutionMode !== undefined
            ? { mockTableDefaultExecutionMode: config.mockTableDefaultExecutionMode }
            : {}),
          ...(config.inputAdvancement !== undefined ? { inputAdvancement: config.inputAdvancement } : {}),
          ...(config.inputAdvancementTypes !== undefined
            ? { inputAdvancementTypes: config.inputAdvancementTypes }
            : {}),
          ...(config.backendAdvancement !== undefined ? { backendAdvancement: config.backendAdvancement } : {}),
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

  /** Descrizioni OpenAPI per firma IA / contesto traduzione DSL avanzamento. */
  const advancementOpenApiHints = React.useMemo(() => {
    const snap = openapiDescriptionSnapshots?.inputs;
    if (!snap) return {};
    const out: Record<string, string> = {};
    for (const inp of config.inputs || []) {
      const n = inp.internalName?.trim();
      if (!n) continue;
      const api = (inp.apiParam || '').trim();
      const fromApi = api ? snap[api] : undefined;
      out[n] = (typeof fromApi === 'string' && fromApi ? fromApi : snap[n]) || '';
    }
    return out;
  }, [openapiDescriptionSnapshots, config.inputs]);

  const advancementSignatureBuilder = React.useCallback(() => {
    const parameters: Record<string, { type: string; description: string }> = {};
    for (const inp of config.inputs || []) {
      const name = inp.internalName?.trim();
      if (!name) continue;
      const desc =
        advancementOpenApiHints[name] ||
        inp.fieldDescription ||
        (inp.apiParam ? `API: ${inp.apiParam}` : '');
      parameters[name] = {
        type: config.inputAdvancementTypes?.[name] ?? 'String',
        description: desc,
      };
    }
    return { parameters };
  }, [advancementOpenApiHints, config.inputs, config.inputAdvancementTypes]);

  const advancementInputNamesKey = React.useMemo(
    () =>
      (config.inputs || [])
        .map((i) => i.internalName?.trim())
        .filter(Boolean)
        .sort()
        .join('|'),
    [config.inputs]
  );

  /** Rimuove regole avanzamento per parametri SEND eliminati. */
  React.useEffect(() => {
    const names = new Set(
      (config.inputs || []).map((i) => i.internalName?.trim()).filter(Boolean) as string[]
    );
    setConfig((prev) => {
      const ia = prev.inputAdvancement;
      const it = prev.inputAdvancementTypes;
      if (!ia && !it) return prev;
      let changed = false;
      const nextA = ia ? { ...ia } : undefined;
      const nextT = it ? { ...it } : undefined;
      if (nextA) {
        for (const k of Object.keys(nextA)) {
          if (!names.has(k)) {
            delete nextA[k];
            changed = true;
          }
        }
      }
      if (nextT) {
        for (const k of Object.keys(nextT)) {
          if (!names.has(k)) {
            delete nextT[k];
            changed = true;
          }
        }
      }
      if (!changed) return prev;
      return {
        ...prev,
        ...(nextA ? { inputAdvancement: nextA } : {}),
        ...(nextT ? { inputAdvancementTypes: nextT } : {}),
      };
    });
  }, [advancementInputNamesKey]);

  /** Chiude l'overlay se il parametro sparisce o l'avanzamento viene disattivato. */
  React.useEffect(() => {
    if (!advancementEditorWireKey) return;
    if (advancementEditorWireKey === BACKEND_RECALC_WIRE_KEY) return;
    const names = new Set(
      (config.inputs || []).map((i) => i.internalName?.trim()).filter(Boolean) as string[]
    );
    if (!names.has(advancementEditorWireKey)) {
      setAdvancementEditorWireKey(null);
      return;
    }
    if (!config.inputAdvancement?.[advancementEditorWireKey]?.enabled) {
      setAdvancementEditorWireKey(null);
    }
  }, [advancementEditorWireKey, config.inputAdvancement, config.inputs]);

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
      setReadApiError('Inserire endpoint operativo o Spec URL (OpenAPI).');
      return;
    }
    setReadApiError(null);
    setReadApiBusy(true);
    try {
      const result = await runBackendCallReadApiForTask(instanceId, projectId, op, config.endpoint.method, {
        openapiSpecUrl: spec || undefined,
        portalConnectionId: resolvePortalConnectionId(),
      });
      if (!result.ok) {
        if (result.portalAuth?.origin) {
          setPortalConnectModal({ open: true, origin: result.portalAuth.origin });
          setReadApiError(null);
          return;
        }
        setReadApiError(result.error);
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<{ taskId: string }>('omnia:backend-read-api-complete', {
            detail: { taskId: instanceId },
          })
        );
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

  const httpMethodLocked = React.useMemo(() => {
    if (!instanceId) return false;
    const st = taskRepository.getTask(instanceId) as Task | null;
    const meta = st?.backendCallSpecMeta;
    if (!meta?.openApiMethodLocked || meta.importState !== 'ok') return false;
    const snap = (meta.openApiMethodLockUrlSnapshot ?? '').trim();
    if (!snap) return false;
    return config.endpoint.url.trim() === snap;
  }, [instanceId, config.endpoint.url, endpointExternalRevision]);

  const updateEndpoint = (updates: Partial<BackendCallConfig['endpoint']>) => {
    setConfig(prev => ({
      ...prev,
      endpoint: { ...prev.endpoint, ...updates }
    }));
  };

  /** Endpoint non documentato: solo GET/POST; normalizza metodi legacy (PUT, …) a GET. */
  React.useEffect(() => {
    if (!instanceId || httpMethodLocked) return;
    const m = config.endpoint.method;
    if (m === 'GET' || m === 'POST') return;
    setConfig((prev) => ({
      ...prev,
      endpoint: { ...prev.endpoint, method: 'GET' },
    }));
  }, [instanceId, httpMethodLocked, config.endpoint.method]);

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

  /** BookFromAgenda: cartella Session (solo UI); persistenza senza prefisso tramite adapter. */
  const mappingSendDisplay = React.useMemo(
    () => wrapBookFromAgendaSessionEntries(mappingSend, config.endpoint?.url),
    [mappingSend, config.endpoint?.url]
  );

  /** Blocchi informativi da `x-omnia.sendBinding` (vincoli one-of) sopra l’albero SEND. */
  const backendSendOneOfHintBlocks = React.useMemo(() => {
    if (!instanceId) return [];
    const meta = taskRepository.getTask(instanceId)?.backendCallSpecMeta?.openapiSendBinding;
    const sets = meta?.requireOneOfSets;
    if (!sets?.length) return [];
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const s of sets) {
      if (!s.label?.trim() || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push({ id: s.id, label: s.label.trim() });
    }
    return out;
  }, [instanceId, config.inputs, swaggerInputContract.length]);

  /** Chiavi ammesse nell’oggetto risultato dello script unificato (= segmenti interni SEND). */
  const unifiedAllowedFieldKeys = React.useMemo(
    () =>
      [
        ...new Set(
          mappingSend
            .map((e) => {
              const w = (e.wireKey || '').trim();
              return w ? paramFieldKeyFromWireKey(w) || w : '';
            })
            .filter(Boolean)
        ),
    ] as string[],
    [mappingSend]
  );

  const advancementSnippetFlowVariables = React.useMemo(
    () =>
      availableVariables.slice(0, 80).map((id) => ({
        id,
        label: getVariableLabel(id, activeFlowTranslations) || id,
      })),
    [availableVariables, activeFlowTranslations]
  );

  const getAdvancementPlayContext = React.useCallback(
    (wk: string) => {
      if (wk === BACKEND_RECALC_WIRE_KEY) {
        const built = buildFullParamRecordFromSendMapping(mappingSend, config.inputAdvancementTypes);
        const prev = { ...built.param };
        return { prev, param: built.param, error: built.error };
      }
      const focusEntry = mappingSend.find((e) => e.wireKey === wk);
      const built = buildParamRecordFromSendMapping(
        mappingSend,
        config.inputAdvancementTypes,
        wk,
        focusEntry
      );
      if (built.error) {
        return { prev: {}, param: {}, error: built.error };
      }
      /** Test Play: `prev` e `param` dai letterali SEND (stesso oggetto, senza override JSON). */
      const prev = { ...built.param };
      return { prev, param: built.param, error: null };
    },
    [config.inputAdvancementTypes, mappingSend]
  );

  const commitAdvancementQuickTest = React.useCallback(
    (wk: string) => {
      const ctx = getAdvancementPlayContext(wk);
      const entry: BackendInputAdvancementEntry =
        wk === BACKEND_RECALC_WIRE_KEY
          ? { ...defaultAdvancementEntry(), ...config.backendAdvancement, enabled: true }
          : config.inputAdvancement?.[wk] ?? defaultAdvancementEntry();
      const paramType = config.inputAdvancementTypes?.[wk] ?? 'String';
      const row = mappingSend.find((e) => e.wireKey === wk);
      const snapshotRow =
        wk === BACKEND_RECALC_WIRE_KEY
          ? mappingSend.map((e) => sendRowValueFingerprint(e)).join('|')
          : sendRowValueFingerprint(row);
      const snapshotNaturalLanguage = (entry.naturalLanguage ?? '').trim();
      const snapshotDsl = (entry.dslExpression ?? '').trim();

      if (ctx.error) {
        setAdvancementQuickTestUi((p) => ({
          ...p,
          [wk]: { chips: [], error: ctx.error, snapshotRow, snapshotNaturalLanguage, snapshotDsl },
        }));
        return;
      }
      const out =
        wk === BACKEND_RECALC_WIRE_KEY
          ? runUnifiedBackendAdvancementPlayEvaluation(
              entry.dslExpression ?? '',
              { prev: ctx.prev, param: ctx.param },
              unifiedAllowedFieldKeys
            )
          : runAdvancementPlayEvaluation(
              entry.dslExpression ?? '',
              { prev: ctx.prev, param: ctx.param },
              paramType
            );
      if (out.ok) {
        if (wk === BACKEND_RECALC_WIRE_KEY && 'resultObject' in out) {
          const unifiedBeforeAfter = buildUnifiedRecalculationBeforeAfterRows(
            ctx.param,
            out.resultObject,
            unifiedAllowedFieldKeys
          );
          setAdvancementQuickTestUi((p) => ({
            ...p,
            [wk]: {
              chips: [],
              unifiedBeforeAfter,
              snapshotRow,
              snapshotNaturalLanguage,
              snapshotDsl,
            },
          }));
        } else {
          const chips = buildAdvancementContextChips(
            { prev: ctx.prev, param: ctx.param },
            out.display,
            { focusWireKey: wk }
          );
          setAdvancementQuickTestUi((p) => ({
            ...p,
            [wk]: { chips, snapshotRow, snapshotNaturalLanguage, snapshotDsl },
          }));
        }
      } else {
        setAdvancementQuickTestUi((p) => ({
          ...p,
          [wk]: { chips: [], error: out.message, snapshotRow, snapshotNaturalLanguage, snapshotDsl },
        }));
      }
    },
    [
      config.backendAdvancement,
      config.inputAdvancement,
      config.inputAdvancementTypes,
      getAdvancementPlayContext,
      mappingSend,
      unifiedAllowedFieldKeys,
    ]
  );

  React.useEffect(() => {
    const cur = advancementEditorWireKey;
    const prevOpen = prevAdvancementOverlayWireKeyRef.current;
    if (prevOpen !== null && cur !== prevOpen) {
      setAdvancementQuickTestUi((s) => {
        if (!(prevOpen in s)) return s;
        const next = { ...s };
        delete next[prevOpen];
        return next;
      });
    }
    prevAdvancementOverlayWireKeyRef.current = cur;
  }, [advancementEditorWireKey]);

  React.useEffect(() => {
    setAdvancementQuickTestUi((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const wk of Object.keys(prev)) {
        const st = prev[wk];
        if (!st) continue;
        if (wk === BACKEND_RECALC_WIRE_KEY) {
          const rs = mappingSend.map((e) => sendRowValueFingerprint(e)).join('|');
          const nl = (config.backendAdvancement?.naturalLanguage ?? '').trim();
          const dsl = (config.backendAdvancement?.dslExpression ?? '').trim();
          if (
            st.snapshotRow !== rs ||
            (st.snapshotNaturalLanguage ?? '') !== nl ||
            st.snapshotDsl !== dsl
          ) {
            delete next[wk];
            changed = true;
          }
          continue;
        }
        const row = mappingSend.find((e) => e.wireKey === wk);
        const rs = sendRowValueFingerprint(row);
        const nl = (config.inputAdvancement?.[wk]?.naturalLanguage ?? '').trim();
        const dsl = (config.inputAdvancement?.[wk]?.dslExpression ?? '').trim();
        if (
          st.snapshotRow !== rs ||
          (st.snapshotNaturalLanguage ?? '') !== nl ||
          st.snapshotDsl !== dsl
        ) {
          delete next[wk];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [mappingSend, config.backendAdvancement, config.inputAdvancement]);

  /** Avanzamento per parametro (checkbox + striscia) rimosso: un solo editor «Ricalcolo» a livello backend. */
  const backendSendAdvancement = undefined;

  const backendSendAdvancementOverlay = React.useMemo(
    () => ({
      openWireKey: advancementEditorWireKey,
      fullSpanWireKey: BACKEND_RECALC_WIRE_KEY,
      overlayTitle:
        advancementEditorWireKey === BACKEND_RECALC_WIRE_KEY ? 'Ricalcolo backend' : undefined,
      onClose: () => setAdvancementEditorWireKey(null),
      renderPanel: (wk: string) => {
        if (wk === BACKEND_RECALC_WIRE_KEY) {
          const entry: BackendInputAdvancementEntry = {
            ...defaultAdvancementEntry(),
            ...config.backendAdvancement,
            enabled: true,
          };
          return (
            <BackendRecalculationEditor
              wireKey={BACKEND_RECALC_WIRE_KEY}
              entry={entry}
              paramType="String"
              editorVariant="unifiedBackend"
              snippetParamFieldKeys={unifiedAllowedFieldKeys}
              snippetFlowVariables={advancementSnippetFlowVariables}
              getPlayContext={getAdvancementPlayContext}
              onPatch={(patch) => {
                const { enabled: _en, ...rest } = patch as Partial<BackendInputAdvancementEntry>;
                setConfig((p) => ({
                  ...p,
                  backendAdvancement: {
                    ...(p.backendAdvancement ?? defaultBackendRecalculationEntry()),
                    ...rest,
                  },
                  inputAdvancement: {},
                }));
              }}
              buildSignature={advancementSignatureBuilder}
              fieldDescriptionHint={
                'Script unico: valuta in un oggetto con chiavi = nomi interni SEND. Le chiavi nell’oggetto restituito (es. startdate) sono i valori di output del ricalcolo, non assegnazioni a `param`. Vietato scrivere su `param`/`prev` (es. `param.startdate = …`); consentito `return { startdate: …, days: … }` o IIFE che restituisce quell’oggetto. Test: solo letterali mapping in `param`/`prev`.'
              }
              onRunAdvancementQuickTest={() => commitAdvancementQuickTest(BACKEND_RECALC_WIRE_KEY)}
              quickTestUi={advancementQuickTestUi[BACKEND_RECALC_WIRE_KEY]}
            />
          );
        }
        const entry = config.inputAdvancement?.[wk] ?? defaultAdvancementEntry();
        const paramType = config.inputAdvancementTypes?.[wk] ?? 'String';
        const rowInp = (config.inputs || []).find((i) => i.internalName?.trim() === wk);
        const fieldHint =
          advancementOpenApiHints[wk] || rowInp?.fieldDescription || undefined;
        return (
          <SendParamAdvancementFullEditor
            wireKey={wk}
            entry={entry}
            paramType={paramType}
            snippetFlowVariables={advancementSnippetFlowVariables}
            getPlayContext={getAdvancementPlayContext}
            onPatch={(patch) =>
              setConfig((p) => {
                const c = p.inputAdvancement?.[wk] ?? defaultAdvancementEntry();
                return {
                  ...p,
                  inputAdvancement: {
                    ...(p.inputAdvancement ?? {}),
                    [wk]: { ...c, ...patch },
                  },
                };
              })
            }
            buildSignature={advancementSignatureBuilder}
            fieldDescriptionHint={fieldHint}
            onRunAdvancementQuickTest={() => commitAdvancementQuickTest(wk)}
            quickTestUi={advancementQuickTestUi[wk]}
          />
        );
      },
    }),
    [
      advancementEditorWireKey,
      advancementOpenApiHints,
      advancementQuickTestUi,
      advancementSignatureBuilder,
      commitAdvancementQuickTest,
      getAdvancementPlayContext,
      config.backendAdvancement,
      config.inputAdvancement,
      config.inputAdvancementTypes,
      config.inputs,
    ]
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
  /** Tutti i parametri SEND (colonne input mock), incluse quelle «parked»: il criterio Test API non dipende da isActive. */
  const mockTableAllInputInternalNames = React.useMemo(() => {
    const cols = config.mockTableColumns;
    if (cols?.length) {
      return cols.filter((c) => c.type === 'input').map((c) => c.name).filter(Boolean);
    }
    return (config.inputs || []).map((i) => i.internalName?.trim()).filter(Boolean) as string[];
  }, [config.mockTableColumns, config.inputs]);

  /** Test API abilitato se esiste almeno una riga con almeno una cella input non vuota (o fallback letterale SEND sulla colonna). */
  const mockTableHasAtLeastOneNonEmptyInputRow = React.useMemo(() => {
    const table = config.mockTable ?? [];
    const names = mockTableAllInputInternalNames;
    if (names.length === 0) {
      return false;
    }
    const fallback = literalFallbackFromSend;
    return table.some((row) => isBackendMockRowAnyInputFilled(row, names, fallback));
  }, [config.mockTable, mockTableAllInputInternalNames, literalFallbackFromSend]);

  const [highlightIncompleteRows, setHighlightIncompleteRows] = React.useState(false);

  React.useEffect(() => {
    if (mockTableHasAtLeastOneNonEmptyInputRow) setHighlightIncompleteRows(false);
  }, [mockTableHasAtLeastOneNonEmptyInputRow]);

  const testApiReadiness = React.useMemo(() => {
    if (mockTableAllInputInternalNames.length === 0) return 'needs_setup' as const;
    if (mockTableHasAtLeastOneNonEmptyInputRow) return 'ready' as const;
    return 'incomplete' as const;
  }, [mockTableAllInputInternalNames.length, mockTableHasAtLeastOneNonEmptyInputRow]);

  const handleTestApi = React.useCallback(() => {
    logBackendCallTest('handleTestApi: click', { testApiReadiness });
    setShowTableView(true);
    if (mockTableAllInputInternalNames.length === 0) {
      logBackendCallTest('handleTestApi: stop (needs_setup — nessun input SEND in tabella)');
      return;
    }

    let canBulk = false;
    flushSync(() => {
      setConfig((prev) => {
        const names =
          (prev.mockTableColumns?.length
            ? prev.mockTableColumns.filter((c) => c.type === 'input').map((c) => c.name)
            : (prev.inputs || []).map((i) => i.internalName?.trim()).filter(Boolean)) ?? [];
        const literals = buildLiteralFallbackFromSendMapping(
          enrichBackendMappingEntriesOpenApi(
            backendInputsToMappingEntries(prev.inputs, knownBackendVariableIdSet),
            'send',
            openapiDescriptionSnapshots
          )
        );
        const nextTable = ensureMockTablePrefilledFromSendLiterals(
          prev.mockTable ?? [],
          names,
          literals,
          prev.mockTableDefaultExecutionMode ?? BackendExecutionMode.MOCK
        );
        canBulk =
          names.length > 0 &&
          nextTable.some((row) => isBackendMockRowAnyInputFilled(row, names, literals));
        const withTable = { ...prev, mockTable: nextTable };
        return {
          ...withTable,
          mockTableColumns: computeMockTableColumnsForSignature(withTable),
        };
      });
    });

    if (!canBulk) {
      logBackendCallTest('handleTestApi: incomplete dopo prefill letterali SEND nella tabella');
      setHighlightIncompleteRows(true);
      return;
    }
    setHighlightIncompleteRows(false);
    setBulkTestNonce((n) => {
      const next = n + 1;
      logBackendCallTest('handleTestApi: avvio bulk mock table', { bulkTestNonce: { from: n, to: next } });
      return next;
    });
  }, [
    knownBackendVariableIdSet,
    openapiDescriptionSnapshots,
    mockTableAllInputInternalNames.length,
  ]);

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
      if (
        raw === 'number' ||
        raw === 'date' ||
        raw === 'time' ||
        raw === 'datetime-local' ||
        raw === 'text' ||
        raw === 'uri' ||
        raw === 'enum'
      ) {
        out[internal] = raw;
      }
    }
    return out;
  }, [instanceId, config.inputs, openapiDescriptionSnapshots]);

  const inputEnumByInternalName = React.useMemo(() => {
    const st = instanceId ? (taskRepository.getTask(instanceId) as Task | null) : null;
    const meta = st?.backendCallSpecMeta as { openapiInputEnumByApiName?: Record<string, string[]> } | undefined;
    const byApi = meta?.openapiInputEnumByApiName;
    if (!byApi || typeof byApi !== 'object') return {} as Record<string, string[]>;
    const out: Record<string, string[]> = {};
    for (const inp of config.inputs || []) {
      const internal = inp.internalName?.trim();
      const api = inp.apiParam?.trim();
      if (!internal || !api) continue;
      const arr = byApi[api];
      if (Array.isArray(arr) && arr.length > 0) out[internal] = arr;
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
          'Scarica OpenAPI via ApiServer (no CORS): path da URL; metodo HTTP determinato da Swagger se il path è nello spec; altrimenti selezionabile manualmente (GET/POST). Discovery dall’endpoint; fallback Spec URL. SEND include body con allOf/oneOf.',
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
      {
        icon: <Columns2 size={16} />,
        label: receiveMappingPanelVisible ? 'Hide Receive' : 'Show Receive',
        onClick: () => setReceiveMappingPanelVisible((v) => !v),
        title: receiveMappingPanelVisible
          ? 'Nascondi il pannello RECEIVE: tutta la larghezza è per SEND.'
          : 'Mostra di nuovo il pannello RECEIVE affiancato a SEND.',
        active: receiveMappingPanelVisible,
        visible: true,
      },
      {
        icon: <Calculator size={16} />,
        label: 'Ricalcolo backend',
        onClick: () =>
          setAdvancementEditorWireKey((k) =>
            k === BACKEND_RECALC_WIRE_KEY ? null : BACKEND_RECALC_WIRE_KEY
          ),
        title:
          'Mostra o nascondi lo script di ricalcolo su tutti i parametri SEND (area come SEND+RECEIVE). Clic di nuovo per chiudere.',
        visible: operationalUrlNonEmpty && !showTableView,
        active: advancementEditorWireKey === BACKEND_RECALC_WIRE_KEY,
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
    receiveMappingPanelVisible,
    advancementEditorWireKey,
    showTableView,
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
                errorMessage={readApiError}
                methodHighlightError={Boolean(readApiError)}
                methodLocked={httpMethodLocked}
                manualHttpMethodOptions="getPost"
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
              portalConnectionId={config.portalConnectionId || resolvePortalConnectionId()}
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
        <div className="flex-1 min-h-[320px] min-w-0 flex flex-col min-h-0 overflow-auto">
          <InterfaceMappingEditor
            variant="backend"
            showVariantToggle={false}
            showEndpoint={false}
            showLayoutHint={false}
            title=""
            listIdPrefix={listIdPrefix}
            backendSend={mappingSendDisplay}
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
            backendSendParamEnumByWireKey={inputEnumByInternalName}
            backendSendAdvancement={backendSendAdvancement}
            backendSendAdvancementOverlay={backendSendAdvancementOverlay}
            backendReceiveColumnVisible={receiveMappingPanelVisible}
            backendSendReceiveSplitRatio={sendReceiveSplitRatio}
            onBackendSendReceiveSplitRatioChange={persistSendReceiveSplitRatio}
            backendSendBodyPrefix={
              backendSendOneOfHintBlocks.length > 0 ? (
                <div className="mb-2 space-y-1 rounded-md border border-teal-500/30 bg-teal-950/35 px-2 py-1.5 text-[10px] leading-snug text-teal-50/95">
                  {backendSendOneOfHintBlocks.map((h) => (
                    <p key={h.id}>
                      <span className="font-semibold text-teal-200/95">{h.id}</span>: {h.label}
                    </p>
                  ))}
                </div>
              ) : undefined
            }
          />
        </div>
        )}
      </div>
      {projectId ? (
        <ConnectPortalModal
          open={portalConnectModal.open}
          origin={portalConnectModal.origin}
          projectId={projectId}
          onClose={() => setPortalConnectModal({ open: false, origin: '' })}
          onConnected={(meta) => {
            mergePortalConnections(meta);
            setConfig((prev) => ({ ...prev, portalConnectionId: meta.id }));
            setPortalConnectModal({ open: false, origin: '' });
          }}
        />
      ) : null}
    </div>
  );
}
