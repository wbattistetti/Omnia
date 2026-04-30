/**
 * Multi-platform structured compilation: {@link PromptIR} + expanded Markdown → {@link PlatformPromptOutput}.
 */

import type { BackendPlaceholderInstance } from './types';
import { getBackendPlaceholderDefinition } from './backendPlaceholderRegistry';
import { agentStructuredSectionsToPromptIR } from './agentStructuredSectionsToPromptIR';
import type { AgentStructuredSections } from './types';
import { AgentPlatform, type PlatformPromptOutput, type PromptIR } from './promptIr';
import { expandAgentPromptMarkdown } from './compileInternals';

export interface CompilePromptOptions {
  /** Markdown body after token expansion (same content as legacy single-string compile). */
  expandedMarkdown: string;
  /** Human-readable tool/placeholder catalog for this task. */
  toolsCatalog: string;
}

function formatToolsCatalog(placeholders: readonly BackendPlaceholderInstance[]): string {
  if (!placeholders.length) {
    return '(no backend placeholders declared)';
  }
  return placeholders
    .map((p) => {
      const def = getBackendPlaceholderDefinition(p.definitionId);
      return def
        ? `• ${def.label} (${p.id})\n  ${def.ioSignature}`
        : `• [unknown definition] ${p.id}`;
    })
    .join('\n\n');
}

/** Splits expanded Markdown at the Examples H3 (English title from IR). */
export function splitExpandedAtExamplesMarkdown(expanded: string): { main: string; examples: string } {
  const re = /\n### Examples\s*\n/i;
  const m = re.exec(expanded);
  if (!m) {
    return { main: expanded.trim(), examples: '' };
  }
  const idx = m.index;
  return {
    main: expanded.slice(0, idx).trim(),
    examples: expanded.slice(idx + m[0].length).trim(),
  };
}

/**
 * Structured compile: IR + pre-expanded Markdown + tool catalog → platform-specific shapes.
 */
export function compilePrompt(ir: PromptIR, platform: AgentPlatform, options: CompilePromptOptions): PlatformPromptOutput {
  const { expandedMarkdown, toolsCatalog } = options;
  const { main, examples } = splitExpandedAtExamplesMarkdown(expandedMarkdown);

  switch (platform) {
    case AgentPlatform.Omnia:
      return {
        platform: AgentPlatform.Omnia,
        irMarkdown: expandedMarkdown.trim() || '—',
      };
    case AgentPlatform.OpenAI:
      return {
        platform: AgentPlatform.OpenAI,
        instructions: main || '—',
        tools: toolsCatalog,
        examples: examples || '(none)',
        retrieval: '(configure knowledge retrieval in the platform console)',
        metadata: JSON.stringify(ir.outputSchema ?? {}, null, 2),
      };
    case AgentPlatform.Anthropic:
      return {
        platform: AgentPlatform.Anthropic,
        system: expandedMarkdown.trim() || '—',
        policies: ir.rules.length ? ir.rules.map((r) => `- ${r}`).join('\n') : '—',
        workflowSteps:
          ir.examples.length > 0
            ? ir.examples.map((e, i) => `${i + 1}. User: ${e.user}\n   Agent: ${e.agent}`).join('\n\n')
            : examples || '—',
      };
    case AgentPlatform.Google:
      return {
        platform: AgentPlatform.Google,
        system: main || expandedMarkdown.trim() || '—',
        safety: ir.rules.length ? ir.rules.join('\n') : '—',
        toolSchemas: toolsCatalog,
      };
    case AgentPlatform.Amazon:
      return {
        platform: AgentPlatform.Amazon,
        instructions: main || expandedMarkdown.trim() || '—',
        actionGroups: toolsCatalog,
        guardrails: ir.rules.length ? ir.rules.join('\n') : '—',
      };
    case AgentPlatform.ElevenLabs:
      return {
        platform: AgentPlatform.ElevenLabs,
        prompt: expandedMarkdown.trim() || '—',
      };
    case AgentPlatform.Meta:
      return {
        platform: AgentPlatform.Meta,
        prompt: expandedMarkdown.trim() || '—',
      };
  }
}

/**
 * Convenience: structured Omnia IR → {@link PlatformPromptOutput} for the selected runtime.
 */
export function compilePromptFromStructuredSections(
  structured: AgentStructuredSections,
  platform: AgentPlatform
): PlatformPromptOutput {
  const ir = agentStructuredSectionsToPromptIR(structured);
  const expandedMarkdown = expandAgentPromptMarkdown(structured, platform);
  const toolsCatalog = formatToolsCatalog(structured.backendPlaceholders);
  return compilePrompt(ir, platform, { expandedMarkdown, toolsCatalog });
}

/**
 * Single preview document for textarea / logs (deterministic).
 */
export function formatPlatformPromptOutput(out: PlatformPromptOutput): string {
  switch (out.platform) {
    case AgentPlatform.OpenAI:
      return [
        '## Instructions',
        out.instructions,
        '',
        '## Tools',
        out.tools,
        '',
        '## Examples',
        out.examples,
        '',
        '## Retrieval',
        out.retrieval,
        '',
        '## Metadata',
        out.metadata,
      ].join('\n');
    case AgentPlatform.Anthropic:
      return ['## System', out.system, '', '## Policies', out.policies, '', '## Workflow steps', out.workflowSteps].join(
        '\n'
      );
    case AgentPlatform.Google:
      return ['## System', out.system, '', '## Safety', out.safety, '', '## Tool schemas', out.toolSchemas].join('\n');
    case AgentPlatform.Amazon:
      return [
        '## Instructions',
        out.instructions,
        '',
        '## Action groups',
        out.actionGroups,
        '',
        '## Guardrails',
        out.guardrails,
      ].join('\n');
    case AgentPlatform.ElevenLabs:
      return ['## Prompt', out.prompt].join('\n');
    case AgentPlatform.Omnia:
      return out.irMarkdown;
    case AgentPlatform.Meta:
      return ['## Prompt', out.prompt].join('\n');
  }
}
