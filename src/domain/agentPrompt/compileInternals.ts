/**
 * Shared Markdown composition and placeholder expansion for agent prompt compilation.
 */

import { getBackendPlaceholderDefinition } from './backendPlaceholderRegistry';
import { BACKEND_DISPLAY_TOKEN_REGEX } from './backendPathDisplay';
import { AgentPlatform } from './promptIr';
import type { BackendPlaceholderDefinition } from './types';
import type { AgentStructuredSections } from './types';
import { OMNIABP_TOKEN_REGEX } from './tokens';
import { AGENT_IR_MARKDOWN_HEADINGS, AGENT_IR_MARKDOWN_SECTION_ORDER } from './irMarkdown';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Exported for the editor composed-runtime view (IR Markdown body, tokens preserved). */
export function composeOmniaIrMarkdown(ir: AgentStructuredSections): string {
  const chunks: string[] = [];
  for (const id of AGENT_IR_MARKDOWN_SECTION_ORDER) {
    const body = String((ir as Record<string, string>)[id] ?? '').trim();
    if (id === 'context' && !body) continue;
    if (id === 'examples' && !body) continue;
    const title = AGENT_IR_MARKDOWN_HEADINGS[id];
    chunks.push(`### ${title}\n\n${body.length > 0 ? body : '—'}`);
  }
  return chunks.join('\n\n').trim();
}

function formatExpandedPlaceholder(def: BackendPlaceholderDefinition, platform: AgentPlatform): string {
  switch (platform) {
    case AgentPlatform.Omnia:
      return `[${def.label} | ${def.ioSignature}]`;
    case AgentPlatform.OpenAI:
    case AgentPlatform.Google:
    case AgentPlatform.Amazon:
      return `<placeholder id="${escapeXml(def.id)}" label="${escapeXml(def.label)}" signature="${escapeXml(def.ioSignature)}" />`;
    case AgentPlatform.Anthropic:
      return `«${def.label}» _${def.ioSignature}_`;
    case AgentPlatform.ElevenLabs:
    case AgentPlatform.Meta:
      return `[[${def.label}: ${def.ioSignature}]]`;
    default:
      return `[${def.label}]`;
  }
}

/**
 * Expands `{{omniabp:…}}` tokens for the given deployment platform style.
 */
export function expandTokens(text: string, platform: AgentPlatform, ir: AgentStructuredSections): string {
  const instanceById = new Map(ir.backendPlaceholders.map((p) => [p.id, p]));
  return text.replace(OMNIABP_TOKEN_REGEX, (_full, rawId: string) => {
    const id = String(rawId).trim();
    const row = instanceById.get(id);
    const def = row ? getBackendPlaceholderDefinition(row.definitionId) : undefined;
    if (!row || !def) {
      return `[omniabp:${id}]`;
    }
    return formatExpandedPlaceholder(def, platform);
  });
}

/**
 * Expands inline `🗄️ path` tokens (drag-drop from flow BackendCall rows).
 */
export function expandBackendDisplayLineTokens(text: string, platform: AgentPlatform): string {
  return text.replace(BACKEND_DISPLAY_TOKEN_REGEX, (full, rawPath: string) => {
    const path = String(rawPath ?? '').trim();
    const def = getBackendPlaceholderDefinition(path);
    if (!def) {
      return full;
    }
    return formatExpandedPlaceholder(def, platform);
  });
}

/** Fully composed IR Markdown with placeholders expanded for the target platform. */
export function expandAgentPromptMarkdown(structured: AgentStructuredSections, platform: AgentPlatform): string {
  const base = composeOmniaIrMarkdown(structured);
  const step = expandTokens(base, platform, structured);
  return expandBackendDisplayLineTokens(step, platform);
}
