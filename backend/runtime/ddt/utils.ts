// DDT Engine Utilities - Backend Runtime
// Utility functions for DDT Engine

/**
 * Resolves action text from action object and translations dictionary
 * Copied from DDTAdapter.ts and adapted for backend
 */
export function resolveActionText(action: any, dict: Record<string, string>): string | undefined {
  if (!action) {
    return undefined;
  }

  // Priority: action.text (edited text in DDT instance) > dict[key] (old translation values) > direct value
  if (action.text && typeof action.text === 'string' && action.text.trim().length > 0) {
    return action.text;
  }

  const p = Array.isArray(action.parameters)
    ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text')
    : undefined;

  if (!p) {
    return undefined;
  }

  const key = p?.value;
  if (!key) {
    return undefined;
  }

  // Try as translation key first
  if (dict && dict[key]) {
    return dict[key];
  }

  // If not found in dict, try as direct text value
  if (typeof key === 'string') {
    const trimmed = key.trim();
    // If it looks like a sentence (has spaces or is longer than typical keys), use it directly
    if (trimmed.length > 0 && (trimmed.includes(' ') || trimmed.length > 30 || !trimmed.match(/^[a-zA-Z0-9_.-]+$/))) {
      return trimmed;
    }
  }

  return undefined;
}

/**
 * Loads NLP contract from a node
 * Accepts either a node object directly or (nodeId, ddt) to find the node
 */
export function loadContract(nodeOrNodeId: any, ddtInstance?: any): any | null {
  // If first param is a string (nodeId) and second param is provided (ddt)
  if (typeof nodeOrNodeId === 'string' && ddtInstance) {
    const node = findOriginalNode(ddtInstance, undefined, nodeOrNodeId);
    if (node && node.nlpContract) {
      return node.nlpContract;
    }
    return null;
  }

  // Otherwise, assume first param is a node object
  const node = nodeOrNodeId;
  const contract = (node as any)?.nlpContract;
  if (contract) {
    return contract;
  }
  return null;
}

/**
 * Gets sub ID for canonical key from contract
 */
export function getSubIdForCanonicalKey(contract: any, canonicalKey: string): string | null {
  if (!contract || !contract.subDataMapping) {
    return null;
  }

  for (const [subId, mapping] of Object.entries(contract.subDataMapping)) {
    const m = mapping as any;
    if (m.canonicalKey === canonicalKey) {
      return subId;
    }
  }

  return null;
}

/**
 * Finds original node in DDT by label and nodeId
 * Simplified version - should be passed from frontend or loaded via callback
 */
export function findOriginalNode(ddtInstance: any, label?: string, nodeId?: string): any | null {
  if (!ddtInstance) {
    return null;
  }

  // Normalize mainData
  const mainDataList = Array.isArray(ddtInstance.mainData)
    ? ddtInstance.mainData
    : ddtInstance.mainData
    ? [ddtInstance.mainData]
    : [];

  // Search in mainData
  for (const mainData of mainDataList) {
    if (nodeId && mainData.id === nodeId) {
      return mainData;
    }
    if (label && mainData.label === label) {
      return mainData;
    }

    // Search in subData
    if (mainData.subData && Array.isArray(mainData.subData)) {
      for (const subData of mainData.subData) {
        if (nodeId && subData.id === nodeId) {
          return subData;
        }
        if (label && subData.label === label) {
          return subData;
        }
      }
    }
  }

  return null;
}

/**
 * Extraction result interface
 */
export interface ExtractionResult {
  values: Record<string, any>; // canonicalKey → value
  hasMatch: boolean;
  source: 'regex' | 'rules' | 'ner' | 'llm' | null;
  confidence?: number;
}

/**
 * Extracts structured values from input text using contract regex patterns
 * Simplified version for backend - only supports regex extraction
 */
export function extractWithContractSync(
  text: string,
  contract: any,
  activeSubId?: string
): ExtractionResult {
  if (!contract || !contract.regex || !contract.regex.patterns || contract.regex.patterns.length === 0) {
    console.warn('[Backend][extractWithContractSync] No contract or regex patterns found');
    return { values: {}, hasMatch: false, source: null };
  }

  // Use mainPattern (pattern[0]) for extraction
  const mainPattern = contract.regex.patterns[0];
  if (!mainPattern) {
    console.warn('[Backend][extractWithContractSync] Main pattern not found');
    return { values: {}, hasMatch: false, source: null };
  }

  try {
    const regex = new RegExp(mainPattern, 'i');
    const match = text.match(regex);

    if (!match || !match.groups) {
      console.log('[Backend][extractWithContractSync] Pattern not matched', {
        text: text.substring(0, 100),
        pattern: mainPattern.substring(0, 80)
      });
      return { values: {}, hasMatch: false, source: null };
    }

    console.log('[Backend][extractWithContractSync] ✅ Pattern matched', {
      fullMatch: match[0],
      groupsCount: Object.keys(match.groups || {}).length
    });

    // Extract all matched groups
    const values: Record<string, any> = {};
    Object.entries(match.groups || {}).forEach(([groupKey, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Convert numeric strings to numbers for date fields
        if (groupKey === 'day' || groupKey === 'month' || groupKey === 'year') {
          const num = parseInt(String(value), 10);
          if (!isNaN(num)) {
            values[groupKey] = num;
            // Normalize 2-digit years to 4 digits (61 -> 1961, 05 -> 2005)
            if (groupKey === 'year' && num < 100) {
              values[groupKey] = num < 50 ? 2000 + num : 1900 + num;
            }
          } else {
            values[groupKey] = value;
          }
        } else {
          values[groupKey] = value;
        }
        console.log(`[Backend][extractWithContractSync] Group matched: ${groupKey} = ${values[groupKey]}`);
      }
    });

    if (Object.keys(values).length > 0) {
      console.log('[Backend][extractWithContractSync] ✅ Extraction completed', {
        values,
        source: 'regex'
      });
      return { values, hasMatch: true, source: 'regex' };
    }

    return { values: {}, hasMatch: false, source: null };
  } catch (error) {
    console.warn('[Backend][extractWithContractSync] Pattern failed (invalid syntax)', {
      pattern: mainPattern.substring(0, 80),
      error: error instanceof Error ? error.message : String(error)
    });
    return { values: {}, hasMatch: false, source: null };
  }
}



