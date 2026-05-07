/**
 * Catalogo v1 osservabilità integrazione (allineato a docs/OBSERVABILITY_INTEGRATION_CARDS_V1.md).
 * Registry stabile + risoluzione da diagnostica BackendCall / BookFromAgenda.
 */

export const INTEGRATION_OBSERVATION_CATALOG_VERSION = 'v1' as const;

/** Input minimale per risoluzione (compatibile con {@link FlowBackendCallInvocation} nel debugger). */
export type IntegrationObservationInvocationLike = {
  taskId: string;
  endpoint: string;
  outcome: string;
  httpStatus?: number | null;
  errorMessage?: string | null;
  responsePreview?: string | null;
  /** Priorità su inferenza se presente nel payload SSE (camelCase / PascalCase lato orchestrator). */
  catalogEvent?: string | null;
  catalogHint?: string | null;
  catalogFields?: Record<string, string> | null;
};

/** Diagnostica webhook ConvAI (compile / tunnel) — compatibile con {@link FlowConvaiWebhookDiagnostic}. */
export type IntegrationObservationConvaiWebhookLike = {
  toolName: string;
  endpoint: string;
  unreachable: boolean;
  errorMessage?: string | null;
};

/** Eventi snake_case del registry v1 (subset implementato in UI + inferenza). */
export type IntegrationObservationEvent =
  | 'validation_rejected'
  | 'query_constraints_wrong_type'
  | 'horizon_missing_for_url'
  | 'agenda_fetch_failed'
  | 'scope_missing'
  | 'snapshot_miss_followup'
  | 'webhook_auth_failed'
  | 'tool_http_error'
  | 'tool_timeout'
  | 'rate_limited'
  | 'session_not_found'
  | 'internal_notify_failed'
  | 'tunnel_not_running'
  | 'dev_tunnel_misconfigured'
  | 'proxy_unreachable'
  | 'express_unreachable'
  | 'redis_unavailable'
  | 'agent_provision_failed'
  | 'grounding_mismatch'
  | 'tool_payload_not_reflected';

export type IntegrationObservationStage =
  | 'compile'
  | 'provision'
  | 'runtime_tool'
  | 'notify'
  | 'proxy';

export type IntegrationObservationSeverity = 'info' | 'warning' | 'error';

export type IntegrationObservationDefinition = {
  readonly titleUi: string;
  readonly hintDefault: string;
  readonly severity: IntegrationObservationSeverity;
  readonly integrationStage: IntegrationObservationStage;
};

/** Registry titoli/hint/severity/stage per eventi noti. */
export const INTEGRATION_OBSERVATION_REGISTRY: Partial<
  Record<IntegrationObservationEvent, IntegrationObservationDefinition>
> = {
  validation_rejected: {
    titleUi: 'Body rifiutato dal backend',
    hintDefault:
      'Allinea tipi e nomi parametri all’OpenAPI (es. oggetti vs stringhe). Controlla il messaggio di errore e la timeline.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  query_constraints_wrong_type: {
    titleUi: 'queryConstraints non valido',
    hintDefault:
      'Invia queryConstraints come oggetto JSON nel body POST, non come stringa. OpenAPI: SchedulingQueryConstraints.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  horizon_missing_for_url: {
    titleUi: 'Finestra date mancante per fetch URL',
    hintDefault:
      'Imposta horizon.start / horizon.end o queryConstraints.horizon per scaricare da URL ICS/Google/Outlook.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  agenda_fetch_failed: {
    titleUi: 'Impossibile ottenere la sorgente agenda',
    hintDefault: 'Verifica agenda.url, agenda.type e raggiungibilità della rete.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  scope_missing: {
    titleUi: 'Scope persistenza mancante',
    hintDefault:
      'Imposta conversationId e projectId coerenti con la prima materializzazione (scope Redis).',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  snapshot_miss_followup: {
    titleUi: 'Snapshot assente al follow-up',
    hintDefault:
      'Esegui prima una chiamata con sorgente agenda o forceRefresh adeguato prima del solo follow-up.',
    severity: 'warning',
    integrationStage: 'runtime_tool',
  },
  webhook_auth_failed: {
    titleUi: 'Autenticazione webhook rifiutata',
    hintDefault: 'Controlla header, segreto interno e variabili d’ambiente lato backend.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  tool_http_error: {
    titleUi: 'Chiamata tool in errore HTTP',
    hintDefault: 'Leggi il body di errore del backend e correggi parametri o disponibilità del servizio.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  tool_timeout: {
    titleUi: 'Timeout sulla chiamata tool',
    hintDefault: 'Riduci payload, verifica latenza o timeout infrastrutturali.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  rate_limited: {
    titleUi: 'Troppe richieste (provider/backend)',
    hintDefault: 'Attendi o riduci frequenza; controlla quote API.',
    severity: 'warning',
    integrationStage: 'runtime_tool',
  },
  session_not_found: {
    titleUi: 'Sessione host non registrata',
    hintDefault:
      'Esegui un run che chiami startAgent con sessionAlias allineato al tool; dopo restart ApiServer rifai il run.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  internal_notify_failed: {
    titleUi: 'Diagnostica non recapitata ad ApiServer',
    hintDefault:
      'Verifica segreto bridge OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET, ApiServer attivo e sessione valida.',
    severity: 'warning',
    integrationStage: 'notify',
  },
  proxy_unreachable: {
    titleUi: 'ApiServer (o upstream) non raggiungibile',
    hintDefault:
      'Verifica che ApiServer sia in esecuzione (es. porta 5000) e che il proxy del dev server sia corretto.',
    severity: 'error',
    integrationStage: 'proxy',
  },
  express_unreachable: {
    titleUi: 'Backend Express non raggiungibile',
    hintDefault: 'Avvia lo stack backend previsto (npm run dev:beNew) e controlla firewall/porte.',
    severity: 'error',
    integrationStage: 'proxy',
  },
  redis_unavailable: {
    titleUi: 'Cache non disponibile',
    hintDefault: 'Avvia Redis e verifica GET /api/health/redis.',
    severity: 'error',
    integrationStage: 'runtime_tool',
  },
  agent_provision_failed: {
    titleUi: 'Creazione agente ConvAI fallita',
    hintDefault:
      'Controlla schema ElevenLabs, quota, residency EU e payload tool (vedi dettaglio nel messaggio).',
    severity: 'error',
    integrationStage: 'provision',
  },
  tunnel_not_running: {
    titleUi: 'Tunnel pubblico assente o non attivo',
    hintDefault:
      'Avvia il tunnel (ngrok) e assicurati che l’URL pubblico punti al backend Express (porta tool webhook).',
    severity: 'error',
    integrationStage: 'proxy',
  },
  dev_tunnel_misconfigured: {
    titleUi: 'Mappa tunnel / URL errata',
    hintDefault:
      'Controlla la mappa dev-tunnel in locale e l’URL usato dal webhook del tool rispetto alla porta esposta.',
    severity: 'warning',
    integrationStage: 'proxy',
  },
  grounding_mismatch: {
    titleUi: 'Opzione proposta non tra quelle disponibili',
    hintDefault:
      'Verifica che l’agente proponga solo valori inclusi nel JSON restituito dal backend (euristica).',
    severity: 'warning',
    integrationStage: 'runtime_tool',
  },
  tool_payload_not_reflected: {
    titleUi: 'Risposta agente senza riferimento al payload del tool',
    hintDefault:
      'Rafforza le istruzioni di sistema: l’agente deve basarsi sull’ultimo output JSON del tool.',
    severity: 'warning',
    integrationStage: 'runtime_tool',
  },
};

export type IntegrationObservationResolved = {
  event: IntegrationObservationEvent;
  titleUi: string;
  hintUi: string;
  severity: IntegrationObservationSeverity;
  integrationStage: IntegrationObservationStage;
  /** Campi chiave per il designer (chiave → valore stringa leggibile). */
  fields: Record<string, string>;
};

function safeSlice(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Estrae code/hint dal JSON di errore BookFromAgenda in responsePreview. */
function parseBookFromAgendaErrorPayload(responsePreview: string | null | undefined): {
  code?: string;
  hint?: string;
  failedStepId?: string;
} {
  if (!responsePreview || !responsePreview.trim().startsWith('{')) return {};
  try {
    const j = JSON.parse(responsePreview) as Record<string, unknown>;
    const code = typeof j.code === 'string' ? j.code : undefined;
    const hint = typeof j.hint === 'string' ? j.hint : undefined;
    const diag = j.diagnostic;
    let failedStepId: string | undefined;
    if (diag && typeof diag === 'object' && !Array.isArray(diag)) {
      const sum = (diag as { summary?: { failedStepId?: string } }).summary;
      if (sum && typeof sum.failedStepId === 'string') failedStepId = sum.failedStepId;
    }
    return { code, hint, failedStepId };
  } catch {
    return {};
  }
}

function mapBackendCodeToEvent(code: string): IntegrationObservationEvent | null {
  switch (code) {
    case 'bookfromagenda_query_constraints_type':
      return 'query_constraints_wrong_type';
    case 'bookfromagenda_body_not_object':
      return 'validation_rejected';
    case 'bookfromagenda_horizon':
      return 'horizon_missing_for_url';
    case 'bookfromagenda_agenda_source':
      return 'agenda_fetch_failed';
    default:
      return null;
  }
}

function inferFromHttpStatus(
  httpStatus: number,
  endpoint: string,
  errorMessage: string | null | undefined
): IntegrationObservationEvent | null {
  if (httpStatus === 401 || httpStatus === 403) return 'webhook_auth_failed';
  if (httpStatus === 404) {
    if (/enqueue|diagnostic|internal/i.test(errorMessage || '') || /session not found/i.test(errorMessage || '')) {
      return 'session_not_found';
    }
    if (/api\s*server|5000|ECONNREFUSED|fetch failed/i.test(errorMessage || '')) return 'proxy_unreachable';
  }
  if (httpStatus === 429) return 'rate_limited';
  if (httpStatus >= 500 && /redis/i.test(errorMessage || '')) return 'redis_unavailable';
  if (httpStatus >= 500 && endpoint.includes('bookfromagenda')) return 'tool_http_error';
  return null;
}

function tryResolveExplicitCatalog(
  inv: IntegrationObservationInvocationLike
): IntegrationObservationResolved | null {
  const rawEv = inv.catalogEvent?.trim();
  if (!rawEv) return null;
  const ev = rawEv as IntegrationObservationEvent;
  const def = INTEGRATION_OBSERVATION_REGISTRY[ev];
  if (!def) return null;

  const fields: Record<string, string> = {};
  const cf = inv.catalogFields;
  if (cf && typeof cf === 'object') {
    for (const [k, v] of Object.entries(cf)) {
      if (v != null && String(v).length > 0) fields[k] = String(v);
    }
  }
  if (inv.taskId) fields.taskId = inv.taskId;
  if (inv.endpoint) fields.endpoint = safeSlice(inv.endpoint, 200);
  if (inv.httpStatus != null) fields.httpStatus = String(inv.httpStatus);

  const hintUi =
    inv.catalogHint && inv.catalogHint.trim().length > 0 ? inv.catalogHint.trim() : def.hintDefault;

  return {
    event: ev,
    titleUi: def.titleUi,
    hintUi,
    severity: def.severity,
    integrationStage: def.integrationStage,
    fields,
  };
}

/**
 * Webhook ConvAI non raggiungibile da ElevenLabs (localhost senza tunnel): carta proxy/tunnel.
 */
export function resolveIntegrationObservationForConvaiWebhook(
  inv: IntegrationObservationConvaiWebhookLike
): IntegrationObservationResolved | null {
  if (!inv.unreachable) return null;
  const msgRaw = inv.errorMessage || '';
  const event: IntegrationObservationEvent = /mappa|mapping|porta errata|wrong\s*port|misconfigured/i.test(
    msgRaw
  )
    ? 'dev_tunnel_misconfigured'
    : 'tunnel_not_running';
  const def = INTEGRATION_OBSERVATION_REGISTRY[event];
  if (!def) return null;

  const fields: Record<string, string> = {
    toolName: inv.toolName,
    endpoint: safeSlice(inv.endpoint, 240),
  };
  if (msgRaw.trim()) fields.detail = safeSlice(msgRaw.trim(), 320);

  return {
    event,
    titleUi: def.titleUi,
    hintUi: msgRaw.trim() ? msgRaw.trim() : def.hintDefault,
    severity: def.severity,
    integrationStage: def.integrationStage,
    fields,
  };
}

function inferFromMessages(
  msg: string,
  endpoint: string
): IntegrationObservationEvent | null {
  const m = msg.toLowerCase();
  if (m.includes('queryconstraints must be') || m.includes('query (alias of queryconstraints)')) {
    return 'query_constraints_wrong_type';
  }
  if (m.includes('conversationid') && m.includes('required')) return 'scope_missing';
  if (m.includes('projectid') && (m.includes('required') || m.includes('scope'))) return 'scope_missing';
  if (m.includes('snapshot') && (m.includes('miss') || m.includes('cache'))) return 'snapshot_miss_followup';
  if (m.includes('enqueue') && m.includes('failed')) return 'internal_notify_failed';
  if (m.includes('econnrefused') || m.includes('fetch failed')) {
    if (endpoint.includes('5000') || /elevenlabs|apiserver/i.test(msg)) return 'proxy_unreachable';
    return 'express_unreachable';
  }
  if (/agents\/create|convai|elevenlabs.*fail/i.test(msg)) return 'agent_provision_failed';
  return null;
}

/**
 * Risolve una carta catalogo da una singola invocazione BackendCall nel debugger.
 * Restituisce null per http_success senza anomalie catalogate (nessuna carta obbligatoria).
 */
export function resolveIntegrationObservation(
  inv: IntegrationObservationInvocationLike
): IntegrationObservationResolved | null {
  const explicit = tryResolveExplicitCatalog(inv);
  if (explicit) return explicit;

  const httpStatus =
    typeof inv.httpStatus === 'number' && Number.isFinite(inv.httpStatus)
      ? Math.floor(inv.httpStatus)
      : null;
  const endpoint = inv.endpoint || '';
  const errMsg = inv.errorMessage || '';
  const oc =
    inv.outcome === 'http_error' || (httpStatus != null && httpStatus >= 400) ? 'error' : inv.outcome;

  const parsed = parseBookFromAgendaErrorPayload(inv.responsePreview);
  let event: IntegrationObservationEvent | null = parsed.code
    ? mapBackendCodeToEvent(parsed.code)
    : null;

  if (!event && errMsg) {
    event = inferFromMessages(errMsg, endpoint);
  }
  if (!event && httpStatus != null && httpStatus >= 400) {
    event = inferFromHttpStatus(httpStatus, endpoint, errMsg);
  }
  if (!event && oc === 'http_error') {
    if (/bookfromagenda/i.test(endpoint)) event = 'validation_rejected';
    else event = 'tool_http_error';
  }

  if (!event) return null;

  const def = INTEGRATION_OBSERVATION_REGISTRY[event];
  if (!def) return null;

  const fields: Record<string, string> = {};
  if (endpoint) fields.endpoint = safeSlice(endpoint, 200);
  if (httpStatus != null) fields.httpStatus = String(httpStatus);
  if (inv.taskId) fields.taskId = inv.taskId;
  if (parsed.failedStepId) fields.failedStepId = parsed.failedStepId;
  if (parsed.code) fields.backendCode = parsed.code;
  if (errMsg) fields.message = safeSlice(errMsg, 400);

  const hintUi = parsed.hint && parsed.hint.trim() ? parsed.hint.trim() : def.hintDefault;

  return {
    event,
    titleUi: def.titleUi,
    hintUi,
    severity: def.severity,
    integrationStage: def.integrationStage,
    fields,
  };
}
