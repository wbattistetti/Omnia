/**
 * Viewer-only display for flow row label text: resolves `[guid]` via flow-scoped `var:<guid>` translations
 * so qualified names (e.g. after S2 rename) appear without rewriting persisted `row.text`.
 */

import { convertDSLGUIDsToLabels, convertDSLLabelsToGUIDs, createVariableMappings } from './conditionCodeConverter';

const GUID_IN_BRACKET =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRACKET_SEGMENT = /\[\s*([^\]]+)\s*\]/g;

function buildLastSegmentToGuid(map: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [guid, label] of map.entries()) {
    const parts = String(label || '')
      .split('.')
      .map((s) => s.trim())
      .filter(Boolean);
    const seg = parts.length > 0 ? parts[parts.length - 1]! : String(label || '').trim();
    if (!seg) continue;
    const k = seg.toLowerCase();
    if (!out.has(k)) out.set(k, guid);
  }
  return out;
}

/**
 * Formats stored row copy for display using current flow translations (`var:<guid>` mappings).
 */
export function formatFlowchartRowTextForViewer(rowText: string | undefined, flowCanvasId: string | undefined): string {
  const raw = String(rowText ?? '');
  if (!raw) return raw;
  const fid = String(flowCanvasId || '').trim();
  if (!fid) return raw;

  const map = createVariableMappings(fid);
  if (map.size === 0) return raw;

  const lastSeg = buildLastSegmentToGuid(map);
  const hinted = raw.replace(BRACKET_SEGMENT, (match, inner: string) => {
    const trimmed = String(inner || '').trim();
    if (!trimmed) return match;
    if (GUID_IN_BRACKET.test(trimmed)) return match;
    const g = lastSeg.get(trimmed.toLowerCase());
    return g ? `[${g}]` : match;
  });

  const guidForm = convertDSLLabelsToGUIDs(hinted, map);
  return convertDSLGUIDsToLabels(guidForm, map);
}
