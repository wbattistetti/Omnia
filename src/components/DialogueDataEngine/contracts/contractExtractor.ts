/**
 * Contract Extractor
 * Esegue escalation usando contract NLP: Regex → Rules → NER → LLM
 */

import type { NLPContract } from './contractLoader';
import { getSubIdForCanonicalKey } from './contractLoader';

export interface ExtractionResult {
    values: Record<string, any>; // canonicalKey → value
    hasMatch: boolean;
    source: 'regex' | 'rules' | 'ner' | 'llm' | null;
    confidence?: number;
}

/**
 * Esegue escalation usando contract (versione sincrona per regex)
 * 1. Prova regex patterns (sincrono) - context-aware
 * 2. Se fallisce, prova rules (extractorCode) - TODO
 * 3. Se fallisce e NER abilitato, prova NER (async)
 * 4. Se fallisce e LLM abilitato, prova LLM (async)
 *
 * @param activeSubId - ID del sub attivo (per context-aware pattern selection)
 */
export function extractWithContractSync(
    text: string,
    contract: NLPContract,
    activeSubId?: string
): ExtractionResult {
    // ESCALATION LEVEL 1: Regex (sincrono) - context-aware
    const regexResult = tryRegexExtraction(text, contract, activeSubId);
    if (regexResult.hasMatch) {
        return { ...regexResult, source: 'regex' };
    }

    // ESCALATION LEVEL 2: Rules (extractorCode)
    // TODO: Eseguire extractorCode TypeScript
    // Per ora ritorna no match

    return { values: {}, hasMatch: false, source: null };
}

/**
 * Esegue escalation async (NER/LLM)
 */
export async function extractWithContractAsync(
    text: string,
    contract: NLPContract
): Promise<ExtractionResult> {
    // ESCALATION LEVEL 3: NER
    if (contract.ner?.enabled) {
        const nerResult = await tryNERExtraction(text, contract);
        if (nerResult.hasMatch) {
            return { ...nerResult, source: 'ner' };
        }
    }

    // ESCALATION LEVEL 4: LLM
    if (contract.llm.enabled) {
        const llmResult = await tryLLMExtraction(text, contract);
        if (llmResult.hasMatch) {
            return { ...llmResult, source: 'llm' };
        }
    }

    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con regex patterns - sempre usa mainPattern per correzione implicita
 * @param activeSubId - ID del sub attivo (per risoluzione ambiguità)
 */
function tryRegexExtraction(text: string, contract: NLPContract, activeSubId?: string): ExtractionResult {
    const values: Record<string, any> = {};

    // ✅ SEMPLIFICATO: usa sempre solo mainPattern (pattern[0]) per correzione implicita
    const mainPattern = contract.regex.patterns[0];
    if (!mainPattern) {
        console.warn('⚠️ [NLP Regex] Main pattern non trovato nel contract');
        return { values: {}, hasMatch: false, source: null };
    }

    // ✅ DEBUG: Log regex pattern per verificare se è compilata
    const hasPlaceholder = mainPattern.includes('${MONTHS_PLACEHOLDER}') || mainPattern.includes('\\${MONTHS_PLACEHOLDER}');
    console.log('🔍 [NLP Regex] Estrazione con mainPattern', {
        mode: activeSubId ? 'collecting_sub' : 'collecting_main',
        activeSubId: activeSubId ? activeSubId.substring(0, 20) + '...' : undefined,
        activeSubCanonicalKey: activeSubId ? contract.subDataMapping[activeSubId]?.canonicalKey : undefined,
        hasPlaceholder: hasPlaceholder ? '❌ YES (NOT COMPILED!)' : '✅ NO (compiled)',
        patternPreview: mainPattern.substring(0, 150),
        templateName: contract.templateName
    });

    try {
        const regex = new RegExp(mainPattern, 'i');
        const match = text.match(regex);

        if (!match || !match.groups) {
            console.log('❌ [NLP Regex] MainPattern non matchato', {
                text: text.substring(0, 100),
                pattern: mainPattern.substring(0, 80)
            });
            return { values: {}, hasMatch: false, source: null };
        }

        console.log(`✅ [NLP Regex] MainPattern MATCHATO`, {
            fullMatch: match[0],
            groupsCount: Object.keys(match.groups).length
        });

        // ✅ Phase 3: Map GUID group names back to canonicalKeys via subDataMapping.groupName.
        // If subDataMapping has groupName entries, use them as the sole lookup keys.
        // Otherwise fall back to using group names directly (legacy path).
        const hasGroupNameMapping = Object.values(contract.subDataMapping).some(m => !!(m as any).groupName);

        const allMatchedGroups: Record<string, string> = {};

        if (hasGroupNameMapping) {
            // New path: iterate subDataMapping, use groupName to extract, key by canonicalKey
            Object.entries(contract.subDataMapping).forEach(([, info]) => {
                const groupName = (info as any).groupName as string | undefined;
                if (!groupName) return;
                const value = match!.groups![groupName];
                if (value !== undefined && value !== null && value !== '') {
                    allMatchedGroups[info.canonicalKey] = value.trim();
                    console.log(`  📝 [NLP Regex] Gruppo (GUID→canonical): ${groupName} → ${info.canonicalKey} = ${value}`);
                }
            });
        } else {
            // Legacy path: use group names directly as keys
            Object.entries(match.groups).forEach(([groupKey, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    allMatchedGroups[groupKey] = value;
                    console.log(`  📝 [NLP Regex] Gruppo matchato (legacy): ${groupKey} = ${value}`);
                }
            });
        }

        if (Object.keys(allMatchedGroups).length === 0) {
            console.log('❌ [NLP Regex] Nessun gruppo matchato');
            return { values: {}, hasMatch: false, source: null };
        }

        // ✅ Logica ambiguità: se match singolo, verifica ambiguità PRIMA di associare
        const groupCount = Object.keys(allMatchedGroups).length;
        if (groupCount === 1) {
            const matchedCanonicalKey = Object.keys(allMatchedGroups)[0];
            const matchedValue = allMatchedGroups[matchedCanonicalKey];

            console.log('🔍 [NLP Regex] Match singolo gruppo, verifica ambiguità', {
                canonicalKey: matchedCanonicalKey,
                value: matchedValue
            });

            // Verifica se il valore è ambiguo
            if (checkAmbiguity(text, contract)) {
                console.log('  ⚠️ [NLP Regex] Valore ambiguo rilevato, risoluzione con contesto');

                // Risolvi ambiguità usando il contesto
                const resolved = resolveWithContext(matchedValue, matchedCanonicalKey, activeSubId, contract);

                if (!resolved.isRelevant) {
                    // Match irrilevante → ritorna no match
                    console.log('  ❌ [NLP Regex] Match irrilevante: sub attivo non è ambiguo', {
                        activeSubCanonicalKey: activeSubId ? contract.subDataMapping[activeSubId]?.canonicalKey : undefined,
                        ambiguousCanonicalKeys: contract.regex.ambiguity?.ambiguousCanonicalKeys || []
                    });
                    return { values: {}, hasMatch: false, source: null };
                }

                // Match rilevante → assegna valore risolto al canonicalKey corretto
                values[resolved.canonicalKey!] = resolved.value;
                console.log('  ✅ [NLP Regex] Ambiguità risolta', {
                    originalMatchedKey: matchedCanonicalKey,
                    resolvedCanonicalKey: resolved.canonicalKey,
                    value: resolved.value
                });
            } else {
                // Non ambiguo → usa valore originale
                values[matchedCanonicalKey] = matchedValue;
                console.log('  ℹ️ [NLP Regex] Valore non ambiguo, usa valore originale');
            }
        } else {
            // Match multi-gruppo → usa tutti i valori (già keyed by canonicalKey)
            Object.assign(values, allMatchedGroups);
            console.log('  ℹ️ [NLP Regex] Match multi-gruppo, usa tutti i valori');
        }

        if (Object.keys(values).length > 0) {
            console.log('✅ [NLP Regex] Estrazione completata con successo', {
                values,
                source: 'regex'
            });
            return { values, hasMatch: true, source: 'regex' };
        }

        return { values: {}, hasMatch: false, source: null };
    } catch (error) {
        console.warn(`⚠️ [NLP Regex] MainPattern fallito (sintassi invalida)`, {
            pattern: mainPattern.substring(0, 80),
            error: error instanceof Error ? error.message : String(error)
        });
        return { values: {}, hasMatch: false, source: null };
    }
}

/**
 * Verifica se un valore matchato è ambiguo (può appartenere a più subData)
 * @param text - Testo originale dell'input
 * @param contract - Contract NLP
 * @returns true se il valore è ambiguo
 */
function checkAmbiguity(text: string, contract: NLPContract): boolean {
    const ambiguityPattern = contract.regex.ambiguityPattern;

    if (!ambiguityPattern) {
        // Nessun pattern ambiguità definito → non è ambiguo
        return false;
    }

    try {
        const regex = new RegExp(ambiguityPattern, 'i');
        const match = text.match(regex);

        const isAmbiguous = match !== null;
        console.log('🔍 [NLP Regex] checkAmbiguity', {
            text: text.substring(0, 50),
            ambiguityPattern: ambiguityPattern.substring(0, 80),
            isAmbiguous
        });

        return isAmbiguous;
    } catch (error) {
        console.warn('⚠️ [NLP Regex] checkAmbiguity fallito (sintassi invalida)', {
            pattern: ambiguityPattern.substring(0, 80),
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

/**
 * Risolve ambiguità assegnando il valore al sub attivo se è tra quelli ambigui
 * @param value - Valore ambiguo estratto
 * @param matchedCanonicalKey - CanonicalKey del gruppo matchato dalla regex principale
 * @param activeSubId - ID del sub attivo (contesto)
 * @param contract - Contract NLP
 * @returns Oggetto con canonicalKey risolto, valore e flag isRelevant
 */
function resolveWithContext(
    value: any,
    matchedCanonicalKey: string,
    activeSubId: string | undefined,
    contract: NLPContract
): { canonicalKey?: string; value?: any; isRelevant: boolean } {
    // Se non c'è sub attivo, mantieni assegnazione originale
    if (!activeSubId) {
        console.log('  ℹ️ [NLP Regex] Nessun activeSubId, mantiene assegnazione originale', {
            canonicalKey: matchedCanonicalKey,
            value
        });
        return { canonicalKey: matchedCanonicalKey, value, isRelevant: true };
    }

    // Ottieni canonicalKey del sub attivo
    const subMapping = contract.subDataMapping[activeSubId];
    if (!subMapping) {
        console.warn('  ⚠️ [NLP Regex] activeSubId non trovato nel subDataMapping', {
            activeSubId: activeSubId.substring(0, 20) + '...'
        });
        return { isRelevant: false };
    }

    const targetCanonicalKey = subMapping.canonicalKey;

    // Verifica se targetCanonicalKey è tra quelli ambigui
    const ambiguousCanonicalKeys = contract.regex.ambiguity?.ambiguousCanonicalKeys || [];

    if (!ambiguousCanonicalKeys.includes(targetCanonicalKey)) {
        // Sub attivo non è ambiguo → match irrilevante
        console.log('  ❌ [NLP Regex] Match irrilevante: sub attivo non è ambiguo', {
            targetCanonicalKey,
            ambiguousCanonicalKeys
        });
        return { isRelevant: false };
    }

    // Sub attivo è ambiguo → assegna valore
    console.log('  ✅ [NLP Regex] Match rilevante: sub attivo è ambiguo', {
        targetCanonicalKey,
        value
    });
    return { canonicalKey: targetCanonicalKey, value, isRelevant: true };
}

/**
 * Prova estrazione con NER
 */
async function tryNERExtraction(_text: string, _contract: NLPContract): Promise<ExtractionResult> {
    // TODO: Implementare chiamata a backend NER
    // Per ora ritorna no match
    return { values: {}, hasMatch: false, source: null };
}

/**
 * Prova estrazione con LLM
 */
async function tryLLMExtraction(text: string, contract: NLPContract): Promise<ExtractionResult> {
    try {
        // Costruisci prompt
        const subDataList = Object.values(contract.subDataMapping)
            .map(m => `- ${m.canonicalKey}: ${m.label} (${m.type})`)
            .join('\n');

        const userPrompt = contract.llm.userPromptTemplate
            .replace('{text}', text)
            .replace('{subData}', subDataList);

        const response = await fetch('/api/nlp/llm-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                field: contract.templateName,
                text,
                subData: Object.values(contract.subDataMapping),
                prompt: userPrompt,
                schema: contract.llm.responseSchema
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                if (candidate.value && typeof candidate.value === 'object') {
                    // Mappa i valori usando canonicalKey
                    const values: Record<string, any> = {};
                    Object.keys(candidate.value).forEach(key => {
                        if (getSubIdForCanonicalKey(contract, key)) {
                            values[key] = candidate.value[key];
                        }
                    });

                    if (Object.keys(values).length > 0) {
                        return {
                            values,
                            hasMatch: true,
                            source: 'llm',
                            confidence: candidate.confidence || 0.7
                        };
                    }
                }
            }
        }
    } catch (error) {
        console.warn('[ContractExtractor] LLM extraction failed', error);
    }

    return { values: {}, hasMatch: false, source: null };
}

