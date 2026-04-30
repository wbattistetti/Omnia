/**
 * Evento globale per mostrare il corpo JSON della richiesta POST /elevenlabs/createAgent (provision ConvAI).
 *
 * **Debug Run (pannello ad ogni Run/compile del debugger):**
 * - In build di sviluppo (`import.meta.env.DEV`) il pannello può aprirsi anche senza task ElevenLabs
 *   (vedi `ensureConvaiAgentsProvisioned`). Disattiva: `localStorage.setItem('omnia.debug.convaiPayloadOnRun', '0')`.
 * - In produzione: `localStorage.setItem('omnia.debug.convaiPayloadOnRun', '1')` per lo stesso comportamento.
 */

export const CONVAI_PROVISION_PAYLOAD_PREVIEW_EVENT = 'omnia:convai-provision-payload-preview';

/**
 * When true, `ensureConvaiAgentsProvisioned` emits a placeholder preview on Run if there is no
 * ElevenLabs AI Agent to provision (so the modal still opens during a debug session).
 */
export function isConvaiPayloadPreviewOnRunDebugEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem('omnia.debug.convaiPayloadOnRun');
      if (v === '0') return false;
      if (v === '1') return true;
    }
  } catch {
    /* ignore */
  }
  return import.meta.env.DEV;
}

export type ConvaiProvisionPayloadPreviewItem = {
  taskId: string;
  displayName: string;
  /** JSON già formattato (stesso body della fetch). */
  bodyText: string;
};

export type ConvaiProvisionPayloadPreviewDetail = {
  items: ConvaiProvisionPayloadPreviewItem[];
};

export function emitConvaiProvisionPayloadPreview(items: ConvaiProvisionPayloadPreviewItem[]): void {
  if (typeof window === 'undefined' || items.length === 0) return;
  window.dispatchEvent(
    new CustomEvent(CONVAI_PROVISION_PAYLOAD_PREVIEW_EVENT, {
      detail: { items } satisfies ConvaiProvisionPayloadPreviewDetail,
    })
  );
}
