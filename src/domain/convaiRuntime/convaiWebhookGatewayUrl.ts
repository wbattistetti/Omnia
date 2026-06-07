/**
 * URL gateway Omnia per webhook ConvAI: applica sendHints (valueKind → ISO) poi inoltra al Backend Call.
 */

/** Express runtime default (legacy gateway BookFromAgenda, designer). */
export const OMNIA_RUNTIME_DEFAULT_ORIGIN = 'http://localhost:3100';

/** ApiServer .NET default (omnia_dialog_step, ElevenLabs bridge). */
export const OMNIA_API_SERVER_DEFAULT_ORIGIN = 'http://127.0.0.1:5000';

/**
 * Origine webhook omnia_dialog_step per ConvAI (ElevenLabs cloud).
 * Default Express :3100 (proxy → ApiServer VB); stesso tunnel ngrok degli altri webhook ConvAI.
 * Override esplicito via `explicitBase` / `gatewayOrigin` in sync.
 */
export function resolveOmniaDialogStepRuntimeOrigin(explicitBase?: string): string {
  return resolveOmniaRuntimeOrigin(explicitBase);
}

/**
 * Origine assoluta del runtime Omnia (gateway, bookfromagenda, proxy designer).
 * Non usare l'origin del Backend Call esterno.
 */
export function resolveOmniaRuntimeOrigin(explicitBase?: string): string {
  const fromArg = explicitBase?.trim().replace(/\/$/, '');
  if (fromArg) return fromArg;
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __OMNIA_APISERVER_BASE__?: string };
    const winBase = w.__OMNIA_APISERVER_BASE__?.trim();
    if (winBase) return winBase.replace(/\/$/, '');
  }
  return OMNIA_RUNTIME_DEFAULT_ORIGIN;
}

export type ConvaiWebhookGatewayParams = {
  /** Origine del runtime (es. http://localhost:3100). */
  origin: string;
  projectId: string;
  agentTaskId: string;
  backendTaskId: string;
};

/** Path relativo del gateway (senza origin). */
export function convaiWebhookGatewayPath(
  projectId: string,
  agentTaskId: string,
  backendTaskId: string
): string {
  const pid = encodeURIComponent(projectId.trim());
  const aid = encodeURIComponent(agentTaskId.trim());
  const bid = encodeURIComponent(backendTaskId.trim());
  return `/api/runtime/convai-webhook/${pid}/${aid}/${bid}`;
}

export function buildConvaiWebhookGatewayUrl(params: ConvaiWebhookGatewayParams): string {
  const origin = params.origin.trim().replace(/\/$/, '');
  return `${origin}${convaiWebhookGatewayPath(params.projectId, params.agentTaskId, params.backendTaskId)}`;
}

/** True se l'URL punta al gateway Omnia (evita loop di re-inoltro). */
export function isConvaiWebhookGatewayUrl(url: string): boolean {
  return /\/api\/runtime\/convai-webhook\//i.test(String(url ?? ''));
}

/** Path relativo omnia_dialog_step (dialogo KB deterministico). */
export function omniaDialogStepPath(projectId: string, agentTaskId: string): string {
  const pid = encodeURIComponent(projectId.trim());
  const aid = encodeURIComponent(agentTaskId.trim());
  return `/api/runtime/omnia-dialog-step/${pid}/${aid}`;
}

export function buildOmniaDialogStepUrl(params: {
  origin: string;
  projectId: string;
  agentTaskId: string;
}): string {
  const origin = params.origin.trim().replace(/\/$/, '');
  return `${origin}${omniaDialogStepPath(params.projectId, params.agentTaskId)}`;
}

/** True se l'URL punta all'endpoint omnia_dialog_step. */
export function isOmniaDialogStepUrl(url: string): boolean {
  return /\/api\/runtime\/omnia-dialog-step\//i.test(String(url ?? ''));
}
