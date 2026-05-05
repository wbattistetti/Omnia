/**
 * Diagnostica tool ConvAI `type: "webhook"` mostrata nel debugger flusso (URL post tunnel).
 */
export type FlowConvaiWebhookDiagnostic = {
  kind: 'convai_webhook';
  /** Nome tool ElevenLabs */
  toolName: string;
  /** taskId del task AI Agent che dichiara il tool (se noto) */
  sourceTaskId?: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  /** Schema body o query (come nel payload API) */
  inputSchemaSummary: { body?: unknown; query?: unknown };
  description?: string;
  /** true se URL punta a localhost e manca mappa tunnel per quella/e porta/e */
  unreachable: boolean;
  errorMessage?: string;
};
