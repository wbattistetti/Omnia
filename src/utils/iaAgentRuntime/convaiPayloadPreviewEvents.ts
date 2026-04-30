/**
 * Evento globale per mostrare il corpo JSON della richiesta POST /elevenlabs/createAgent (provision ConvAI).
 */

export const CONVAI_PROVISION_PAYLOAD_PREVIEW_EVENT = 'omnia:convai-provision-payload-preview';

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
