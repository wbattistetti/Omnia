// Utility to convert between readable labels and GUIDs in condition scripts
// This allows conditions to be language-independent (saved with GUIDs)
// while displaying in the editor with labels in the current IDE language

import { flowchartVariablesService } from '../services/FlowchartVariablesService';

/**
 * Converts label → GUID in condition script (for saving to DB)
 * Example: ctx["data A.Month"] → ctx["e6f23015-00fd-4f19-9a16-67678326aaaf"]
 *
 * This ensures conditions are language-independent when persisted.
 */
export function convertScriptLabelsToGuids(script: string): string {
  console.log('[ConditionScriptConverter][LABEL→GUID] 🚀 START conversion', {
    scriptLength: script?.length || 0,
    scriptPreview: script?.substring(0, 200) || ''
  });

  if (!script || typeof script !== 'string') {
    console.log('[ConditionScriptConverter][LABEL→GUID] ⚠️ Invalid script, returning as-is');
    return script;
  }

  // Regex to find ctx["label"], ctx['label'], ctx[`label`], getVar(ctx, "label"), etc.
  // Pattern 1: ctx["label"] or ctx['label'] or ctx[`label`]
  const ctxPattern = /ctx\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;

  // Pattern 2: getVar(ctx, "label") or getVar(ctx, 'label') or getVar(ctx, `label`)
  const getVarPattern = /getVar\s*\(\s*ctx\s*,\s*(["'`])([^"'`]+)\1\s*\)/g;

  let converted = script;

  // Convert ctx["label"] patterns
  converted = converted.replace(ctxPattern, (match, quote, label) => {
    console.log('[ConditionScriptConverter][LABEL→GUID] 🔍 Found ctx pattern', {
      match,
      label,
      quote
    });

    // ✅ Get all available names for debugging
    const allNames = flowchartVariablesService.getAllReadableNames();
    console.log('[ConditionScriptConverter][LABEL→GUID] 📋 Available readable names', {
      totalCount: allNames.length,
      allNames: allNames,
      searchingFor: label
    });

    const guid = flowchartVariablesService.getNodeId(label);
    if (guid) {
      console.log('[ConditionScriptConverter][LABEL→GUID] ✅ Converting label → GUID', {
        label,
        guid: guid.substring(0, 20) + '...',
        fullGuid: guid
      });
      return `ctx[${quote}${guid}${quote}]`;
    }
    // If no GUID found, keep original (might be a static variable or constant)
    console.warn('[ConditionScriptConverter][LABEL→GUID] ⚠️ No GUID found for label', {
      label,
      match,
      availableNames: allNames,
      availableNamesCount: allNames.length,
      exactMatch: allNames.includes(label),
      partialMatches: allNames.filter(n => n.includes(label) || label.includes(n))
    });
    return match;
  });

  // Convert getVar(ctx, "label") patterns
  converted = converted.replace(getVarPattern, (match, quote, label) => {
    console.log('[ConditionScriptConverter][LABEL→GUID] 🔍 Found getVar pattern', {
      match,
      label,
      quote
    });
    const guid = flowchartVariablesService.getNodeId(label);
    if (guid) {
      console.log('[ConditionScriptConverter][LABEL→GUID] ✅ Converting getVar label → GUID', {
        label,
        guid: guid.substring(0, 20) + '...',
        fullGuid: guid
      });
      return `getVar(ctx, ${quote}${guid}${quote})`;
    }
    // If no GUID found, keep original
    console.warn('[ConditionScriptConverter][LABEL→GUID] ⚠️ No GUID found for getVar label', {
      label,
      match,
      availableNames: flowchartVariablesService.getAllReadableNames().slice(0, 10)
    });
    return match;
  });

  return converted;
}

/**
 * Converts GUID → label in condition script (for displaying in editor)
 * Example: ctx["e6f23015-00fd-4f19-9a16-67678326aaaf"] → ctx["data A.Month"]
 *
 * This allows the editor to show readable names in the current IDE language.
 */
export function convertScriptGuidsToLabels(script: string): string {
  console.log('[ConditionScriptConverter][GUID→LABEL] 🚀 START conversion', {
    scriptLength: script?.length || 0,
    scriptPreview: script?.substring(0, 200) || ''
  });

  if (!script || typeof script !== 'string') {
    console.log('[ConditionScriptConverter][GUID→LABEL] ⚠️ Invalid script, returning as-is');
    return script;
  }

  // Regex to find ctx["guid"], ctx['guid'], ctx[`guid`], getVar(ctx, "guid"), etc.
  // Pattern 1: ctx["guid"] or ctx['guid'] or ctx[`guid`]
  const ctxPattern = /ctx\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;

  // Pattern 2: getVar(ctx, "guid") or getVar(ctx, 'guid') or getVar(ctx, `guid`)
  const getVarPattern = /getVar\s*\(\s*ctx\s*,\s*(["'`])([^"'`]+)\1\s*\)/g;

  // UUID pattern to detect GUIDs
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let converted = script;

  // Convert ctx["guid"] patterns
  converted = converted.replace(ctxPattern, (match, quote, key) => {
    console.log('[ConditionScriptConverter][GUID→LABEL] 🔍 Found ctx pattern', {
      match,
      key,
      quote,
      isGuid: guidPattern.test(key)
    });

    // Check if key looks like a GUID
    if (guidPattern.test(key)) {
      const label = flowchartVariablesService.getReadableName(key);
      if (label) {
        console.log('[ConditionScriptConverter][GUID→LABEL] ✅ Converting GUID → label', {
          guid: key.substring(0, 20) + '...',
          fullGuid: key,
          label
        });
        return `ctx[${quote}${label}${quote}]`;
      }
      // GUID found but no label mapping - might be a deleted variable
      console.warn('[ConditionScriptConverter][GUID→LABEL] ⚠️ No label found for GUID', {
        guid: key.substring(0, 20) + '...',
        fullGuid: key,
        match
      });
    } else {
      console.log('[ConditionScriptConverter][GUID→LABEL] ℹ️ Key is not a GUID, keeping as-is', {
        key,
        match
      });
    }
    // Not a GUID or no mapping found, keep original
    return match;
  });

  // Convert getVar(ctx, "guid") patterns
  converted = converted.replace(getVarPattern, (match, quote, key) => {
    console.log('[ConditionScriptConverter][GUID→LABEL] 🔍 Found getVar pattern', {
      match,
      key,
      quote,
      isGuid: guidPattern.test(key)
    });

    // Check if key looks like a GUID
    if (guidPattern.test(key)) {
      const label = flowchartVariablesService.getReadableName(key);
      if (label) {
        console.log('[ConditionScriptConverter][GUID→LABEL] ✅ Converting getVar GUID → label', {
          guid: key.substring(0, 20) + '...',
          fullGuid: key,
          label
        });
        return `getVar(ctx, ${quote}${label}${quote})`;
      }
      // GUID found but no label mapping
      console.warn('[ConditionScriptConverter][GUID→LABEL] ⚠️ No label found for getVar GUID', {
        guid: key.substring(0, 20) + '...',
        fullGuid: key,
        match
      });
    } else {
      console.log('[ConditionScriptConverter][GUID→LABEL] ℹ️ Key is not a GUID, keeping as-is', {
        key,
        match
      });
    }
    // Not a GUID or no mapping found, keep original
    return match;
  });

  console.log('[ConditionScriptConverter][GUID→LABEL] ✅ END conversion', {
    originalLength: script.length,
    convertedLength: converted.length,
    changed: script !== converted,
    convertedPreview: converted.substring(0, 200)
  });

  return converted;
}

