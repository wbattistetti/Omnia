/** Id sessione tool webhook ConvAI (`omnia_conv_…`) allineato a provision / Test agente. */
export function newSessionConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `omnia_conv_${crypto.randomUUID()}`;
  }
  return `omnia_conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
