/**
 * Utilities for cloning and adapting NLP Contracts
 */

import type { NLPContract } from '../components/DialogueDataEngine/contracts/contractLoader';

/**
 * Clones and adapts a contract from a template to an instance
 * ✅ COMPILA la regex se contiene placeholder (es. per date)
 *
 * @param sourceContract - The contract from the template
 * @param instanceId - GUID of the instance node
 * @param sourceTemplateId - GUID of the original template
 * @param subIdMapping - Mapping from sub-template IDs to sub-instance IDs
 * @param projectLanguage - Language code (IT, PT, EN, etc.) for regex compilation - REQUIRED
 * @returns A new contract adapted for the instance
 * @throws Error if projectLanguage is missing when needed for date contracts
 */
export async function cloneAndAdaptContract(
    sourceContract: NLPContract,
    instanceId: string,
    sourceTemplateId: string,
    subIdMapping: Record<string, string> = {},
    projectLanguage: string
): Promise<NLPContract> {
    console.log('🔍 [contractUtils] Clone contract START', {
        templateName: sourceContract.templateName,
        instanceId,
        sourceTemplateId,
        sourceSubDataMappingCount: Object.keys(sourceContract.subDataMapping).length,
        sourceSubDataMappingKeys: Object.keys(sourceContract.subDataMapping).slice(0, 5),
        subIdMappingProvided: Object.keys(subIdMapping).length,
        subIdMapping,
        projectLanguage
    });

    // Deep clone the contract
    const cloned = JSON.parse(JSON.stringify(sourceContract)) as NLPContract;

    // Update templateId to match instance GUID
    cloned.templateId = instanceId;

    // Add reference to source template
    cloned.sourceTemplateId = sourceTemplateId;

    // Update subDataMapping: replace sub-template GUIDs with sub-instance GUIDs
    const newMapping: Record<string, any> = {};
    for (const [subTemplateId, mapping] of Object.entries(cloned.subDataMapping)) {
        const subInstanceId = subIdMapping[subTemplateId];
        if (subInstanceId) {
            // Use the mapped sub-instance ID
            newMapping[subInstanceId] = { ...mapping };
            console.log(`  ✅ [contractUtils] Mapped sub: ${mapping.canonicalKey} | ${subTemplateId} → ${subInstanceId}`);
        } else {
            // If no mapping found, keep original (for backward compatibility or if sub doesn't exist)
            console.warn('  ⚠️ [contractUtils] Sub-template ID NOT found in mapping, keeping original', {
                subTemplateId,
                canonicalKey: mapping.canonicalKey,
                availableMappings: Object.keys(subIdMapping),
                contractTemplateName: cloned.templateName
            });
            newMapping[subTemplateId] = { ...mapping };
        }
    }
    cloned.subDataMapping = newMapping;

    // ✅ COMPILA REGEX se contiene placeholder (es. per contract date)
    if (cloned.templateName === 'date' && cloned.regex?.patterns?.length > 0) {
        const templateRegex = cloned.regex.patterns[0];

        // Verifica se contiene placeholder
        if (templateRegex.includes('${MONTHS_PLACEHOLDER}')) {
            // ✅ projectLanguage è OBBLIGATORIO - nessun fallback
            if (!projectLanguage) {
                throw new Error(`[contractUtils] projectLanguage is REQUIRED for date contract compilation. Contract: ${cloned.templateName}, instanceId: ${instanceId}`);
            }

            const language = projectLanguage.toUpperCase();

            console.log('🔍 [contractUtils] Compiling regex for date contract', {
                language,
                templateRegex: templateRegex.substring(0, 100)
            });

            // Carica costanti mesi per quella lingua - lancia errore se non trova
            const monthsPattern = await loadMonthsPatternForLanguage(language);

            // Sostituisci placeholder con mesi reali
            const compiledRegex = templateRegex.replace('${MONTHS_PLACEHOLDER}', monthsPattern);

            cloned.regex.patterns = [compiledRegex];

            console.log('✅ [contractUtils] Regex compilata per istanza', {
                language,
                templateRegex: templateRegex.substring(0, 80) + '...',
                compiledRegex: compiledRegex.substring(0, 100) + '...',
                monthsCount: monthsPattern.split('|').length
            });
        }
    }

    console.log('✅ [contractUtils] Clone contract DONE', {
        instanceId,
        newMappingCount: Object.keys(newMapping).length,
        newMappingKeys: Object.keys(newMapping).slice(0, 5),
        canonicalKeys: Object.values(newMapping).map((m: any) => m.canonicalKey),
        regexCompiled: cloned.regex?.patterns?.[0]?.includes('${MONTHS_PLACEHOLDER}') === false
    });

    return cloned;
}

/**
 * Carica pattern mesi per una lingua specifica dal backend
 * ✅ NESSUN FALLBACK - lancia errore se non trova i mesi
 * @throws Error se i mesi non sono trovati o se c'è un errore di rete
 */
async function loadMonthsPatternForLanguage(language: string): Promise<string> {
    const response = await fetch(`/api/constants/months/${language}`);

    if (!response.ok) {
        throw new Error(`[contractUtils] Failed to load months constants for language ${language}: HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // data.values è l'array unificato
    const months = Array.isArray(data.values) ? data.values : [];

    if (months.length === 0) {
        throw new Error(`[contractUtils] No months found for language: ${language}. Constants collection may be empty or missing.`);
    }

    // Ordina per lunghezza (più lunghi prima per match corretto)
    const unique = Array.from(new Set(months)).sort((a, b) => b.length - a.length);

    // Costruisci pattern regex: (gennaio|febbraio|...|gen\.?|feb\.?|...)
    const pattern = `(${unique.join('|')})`;

    console.log('✅ [contractUtils] Pattern mesi caricato', {
        language,
        monthsCount: unique.length,
        sampleMonths: unique.slice(0, 5)
    });

    return pattern;
}

/**
 * Creates a sub-ID mapping from template sub-IDs to instance sub-IDs
 * Used when creating composite template instances
 */
export function createSubIdMapping(
    templateSubIds: string[],
    instanceSubIds: string[]
): Record<string, string> {
    const mapping: Record<string, string> = {};

    if (templateSubIds.length !== instanceSubIds.length) {
        console.warn('⚠️ [contractUtils] Sub-ID count mismatch', {
            templateCount: templateSubIds.length,
            instanceCount: instanceSubIds.length
        });
    }

    const minLength = Math.min(templateSubIds.length, instanceSubIds.length);
    for (let i = 0; i < minLength; i++) {
        mapping[templateSubIds[i]] = instanceSubIds[i];
    }

    return mapping;
}

