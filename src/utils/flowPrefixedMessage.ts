/**
 * Parses optional multi-flow compile prefix [flowId] on error messages.
 */

export function splitFlowPrefixedMessage(message: string): { flowTag: string | null; body: string } {
  const m = message.match(/^\[([^\]]+)]\s*(.*)$/s);
  if (m) {
    return { flowTag: m[1].trim() || null, body: m[2] ?? '' };
  }
  return { flowTag: null, body: message };
}

export function withFlowPrefix(flowTag: string | null, body: string): string {
  if (!flowTag) return body;
  return `[${flowTag}] ${body}`;
}
