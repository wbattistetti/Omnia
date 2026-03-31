/**
 * Optional sync of engine payloads into DialogueTaskService template cache.
 * React/session state must always be updated by the caller (onContractChange);
 * this module only mutates cached templates when present.
 */

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';
import DialogueTaskService from '@services/DialogueTaskService';

export type TemplateCacheSyncResult = 'updated' | 'cache_miss' | 'no_catalogue_id';

function ensureTemplateDataContract(
  catalogueId: string,
  template: { label?: string; dataContract?: DataContract | null }
): DataContract {
  if (!template.dataContract) {
    template.dataContract = {
      templateId: catalogueId,
      templateName: template.label || catalogueId,
      subDataMapping: {},
      engines: [],
      outputCanonical: { format: 'value' },
    };
  }
  return template.dataContract;
}

/**
 * Writes regex pattern into the cached template's regex engine (if the template exists).
 */
export function syncRegexPatternToTemplateCache(
  catalogueId: string,
  normalizedPattern: string
): TemplateCacheSyncResult {
  if (!catalogueId.trim()) {
    return 'no_catalogue_id';
  }
  const template = DialogueTaskService.getTemplate(catalogueId);
  if (!template) {
    console.warn('[contractTemplateSync] Template not in catalogue cache', { catalogueId });
    return 'cache_miss';
  }
  const dc = ensureTemplateDataContract(catalogueId, template);
  const engines = dc.engines || [];
  const regexEngine = engines.find((c: any) => c.type === 'regex');
  if (regexEngine) {
    regexEngine.patterns = [normalizedPattern];
  } else {
    engines.push({ type: 'regex', enabled: true, patterns: [normalizedPattern], examples: [] });
    dc.engines = engines;
  }
  DialogueTaskService.markTemplateAsModified(catalogueId);
  return 'updated';
}

/**
 * Writes grammarflow payload into the cached template (if present).
 */
export function syncGrammarFlowToTemplateCache(
  catalogueId: string,
  grammar: Grammar,
  testPhrases: string[]
): TemplateCacheSyncResult {
  if (!catalogueId.trim()) {
    return 'no_catalogue_id';
  }
  const template = DialogueTaskService.getTemplate(catalogueId);
  if (!template) {
    console.warn('[contractTemplateSync] GrammarFlow template not in catalogue cache', {
      catalogueId,
    });
    return 'cache_miss';
  }
  const dc = ensureTemplateDataContract(catalogueId, template);
  const engines = dc.engines || [];
  const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');
  if (grammarFlowEngine) {
    grammarFlowEngine.grammarFlow = grammar;
  } else {
    engines.push({
      type: 'grammarflow',
      enabled: true,
      grammarFlow: grammar,
    });
    dc.engines = engines;
  }
  dc.testPhrases = testPhrases;
  DialogueTaskService.markTemplateAsModified(catalogueId);
  return 'updated';
}

/**
 * Updates only test phrases on the cached template contract.
 */
export function syncTestPhrasesToTemplateCache(
  catalogueId: string,
  phrases: string[]
): TemplateCacheSyncResult {
  if (!catalogueId.trim()) {
    return 'no_catalogue_id';
  }
  const template = DialogueTaskService.getTemplate(catalogueId);
  if (!template) {
    console.warn('[contractTemplateSync] Template not in cache (test phrases)', { catalogueId });
    return 'cache_miss';
  }
  const dc = ensureTemplateDataContract(catalogueId, template);
  dc.testPhrases = phrases;
  DialogueTaskService.markTemplateAsModified(catalogueId);
  return 'updated';
}
