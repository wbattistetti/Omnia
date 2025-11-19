// ✅ NEW: AI is the single source of truth for types
// This function ONLY provides fallback to 'generic' if type is missing

type Node = any;

function ensureId(label: string, fallback: string) {
  return `${label || fallback}`;
}

/**
 * Normalize DDT main nodes - AI is the source of truth
 * Only adds 'generic' as fallback if type is completely missing
 */
export function normalizeDDTMainNodes(mains: Node[]): Node[] {
  return (mains || []).map((main) => {
    const label = String(main?.label || '').trim();
    const existingKind = String(main?.kind || '').trim();
    const existingType = String(main?.type || '').trim();
    const manual = String((main as any)?._kindManual || '').trim();

    // ✅ DEBUG: Verifica se il contract arriva qua
    console.log('🔍 [normalizeKinds] Input node', {
      label,
      hasNlpContract: !!((main as any).nlpContract),
      hasTemplateId: !!((main as any).templateId),
      mainKeys: Object.keys(main).slice(0, 15)
    });

    // ✅ NEW: Respect AI type inference as the primary source
    // Priority: 1. Manual override, 2. AI inferred type, 3. Fallback to 'generic'
    let kind: string;
    if (manual) {
      kind = manual;
    } else if (existingType && existingType !== 'auto') {
      // AI inferred type from backend (this is the source of truth!)
      kind = existingType;
    } else if (existingKind && existingKind !== 'auto') {
      kind = existingKind;
    } else {
      // ⚠️ Fallback to 'generic' only when type is missing
      kind = 'generic';
      console.warn('[DDT normalizeKinds] No type found for field, using generic fallback', { label });
    }

    try {
      // eslint-disable-next-line no-console
      console.log('[DDT normalizeKinds] AI type accepted', {
        label,
        aiType: existingType,
        finalKind: kind,
        manual: manual || undefined
      });
    } catch { }

    // ✅ NEW: Copy structure as-is from AI, no override!
    // ✅ CRITICAL: Preserve nlpContract, templateId from original node
    // IMPORTANTE: nlpContract e templateId DEVONO essere assegnati DOPO lo spread per non essere sovrascritti
    const out: Node = {
      ...main,
      kind,
      type: kind  // Ensure type matches kind
    };

    // ✅ CRITICO: Assegna nlpContract e templateId DOPO lo spread per evitare sovrascrittura
    if ((main as any).nlpContract) {
      out.nlpContract = (main as any).nlpContract;
      console.log('✅ [normalizeKinds] Preserved nlpContract', {
        label,
        hasContract: true,
        contractTemplateName: out.nlpContract.templateName
      });
    }
    if ((main as any).templateId) {
      out.templateId = (main as any).templateId;
      console.log('✅ [normalizeKinds] Preserved templateId', {
        label,
        templateId: out.templateId
      });
    }

    // Copy subData as-is (no upsertSub!)
    out.subData = Array.isArray(main.subData) ? [...main.subData] : [];

    // ✅ NEW: Ensure each subData item has an ID and fallback type
    out.subData = out.subData.map((sub: Node) => {
      const subLabel = String(sub?.label || '').trim();
      const subType = String(sub?.type || '').trim();

      const subOut: any = {
        ...sub,
        id: sub.id || ensureId(subLabel, 'subfield'),
        type: subType || 'generic',  // Only fallback if missing
        label: subLabel
      };

      // ✅ CRITICO: Assegna nlpContract e templateId DOPO lo spread per evitare sovrascrittura
      if ((sub as any).nlpContract) {
        subOut.nlpContract = (sub as any).nlpContract;
      }
      if ((sub as any).templateId) {
        subOut.templateId = (sub as any).templateId;
      }

      return subOut;
    });

    try {
      // eslint-disable-next-line no-console
      console.log('[DDT normalizeKinds][result]', {
        label,
        chosenKind: out.kind,
        aiType: existingType,
        manual: manual || undefined,
        subs: (out.subData || []).map((s: any) => ({
          label: s?.label,
          type: s?.type,
          required: s?.required
        })),
      });
    } catch { }

    return out;
  });
}


