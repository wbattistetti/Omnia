/**
 * Regola standard ConvAI/webhook: stringhe vuote su campi opzionali = assenza del campo.
 * Documentata in OpenAPI (Read API), report readiness e normalizzazione gateway runtime.
 */

/** Identificativo versione regola persistito su `backendCallSpecMeta`. */
export const CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID = 'omnia.convai.optional-empty-string/v1';

/** Extension OpenAPI (`info` o proprietà schema) per tracciare aderenza al contratto. */
export const OPENAPI_X_OMNIA_CONVAI_OPTIONAL_SEMANTICS = 'convaiOptionalSemantics';

/** Nota breve per description di campo opzionale nello schema materializzato. */
export const OPENAPI_OPTIONAL_FIELD_DESCRIPTION_SUFFIX =
  ' [ConvAI] Stringa vuota "" = campo assente (equivalente a omit); obbligatorio per webhook ElevenLabs.';

export const CONVAI_OPTIONAL_EMPTY_STRING_RULE_TITLE =
  'Campi opzionali: "" = assente (ConvAI / ElevenLabs)';

/** Riga singola per UI e contratti. */
export const CONVAI_OPTIONAL_EMPTY_STRING_RULE_SHORT =
  'Su ogni parametro opzionale del body: la stringa vuota "" deve essere interpretata come assenza del campo (equivalente a undefined / omit).';

/** Blocco completo per report e handoff backend. */
export const CONVAI_OPTIONAL_EMPTY_STRING_RULE_DOCUMENTATION = `${CONVAI_OPTIONAL_EMPTY_STRING_RULE_TITLE}

Regola standard per tutti i backend esposti come tool webhook ConvAI (ElevenLabs, gateway Omnia, agenda-solver, next-window, BookFromAgenda, ecc.).

Motivazione
- ElevenLabs, invocando i webhook, tende a inviare l'intero JSON Schema del tool con valori vuoti (es. constraints.horizon.start: "", array vuoti, oggetti annidati vuoti).
- Se il backend tratta "" come valore reale, filtri e query possono restituire zero risultati pur con HTTP 200.

Contratto
- Per ogni campo **opzionale** (non in \`required\` OpenAPI, o elencato in optionalApiParams / design-time opzionale):
  - \`""\` (stringa vuota) ≡ campo **assente** (\`undefined\` / chiave omessa).
  - Dopo normalizzazione, array vuoti \`[]\` e oggetti senza proprietà significative possono essere omessi (stesso effetto semantico).
- I campi **obbligatori** restano invariati: stringa vuota su obbligatorio = errore di validazione o regola specifica documentata (es. conversationId runtime non vuoto su BookFromAgenda).

Implementazione attesa
- **Backend upstream** (Supabase, Express, …): applicare la regola in ingresso prima della logica di business.
- **Gateway Omnia** (\`/api/runtime/convai-webhook/...\`): strip preventivo prima di apply sendHints e forward.
- **OpenAPI / Omnia designer**: description arricchite al Read API; report readiness e sezione USE OF BACKENDS.

Riferimento
- ID regola: ${CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID}`;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Valore «vuoto» da trattare come assente (normalizzazione gateway). */
export function isConvaiEmptyOptionalSentinel(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (isRecord(value) && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Rimuove ricorsivamente stringhe vuote, null, array vuoti e oggetti vuoti dal body tool ConvAI.
 * Usato dal gateway prima di sendHints/forward upstream.
 */
export function stripEmptyConvaiOptionalFields(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const next = value
      .map((item) => stripEmptyConvaiOptionalFields(item))
      .filter((item) => item !== undefined && !isConvaiEmptyOptionalSentinel(item));
    return next.length === 0 ? undefined : next;
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      const stripped = stripEmptyConvaiOptionalFields(raw);
      if (stripped === undefined || isConvaiEmptyOptionalSentinel(stripped)) continue;
      out[key] = stripped;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value;
}

/** Normalizza body oggetto in-place (mutating) per il gateway Express. */
export function stripEmptyConvaiOptionalFieldsInPlace(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    const stripped = stripEmptyConvaiOptionalFields(body[key]);
    if (stripped === undefined || isConvaiEmptyOptionalSentinel(stripped)) {
      delete body[key];
    } else {
      body[key] = stripped as unknown;
    }
  }
}

function appendDescriptionSuffix(existing: unknown, suffix: string): string {
  const base = typeof existing === 'string' ? existing.trim() : '';
  if (base.includes(suffix.trim())) return base;
  return base ? `${base}${suffix}` : suffix.trim();
}

function cloneSchemaNode(node: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(node)) as Record<string, unknown>;
}

function annotateOptionalSchemaNode(
  node: Record<string, unknown>,
  optional: boolean
): Record<string, unknown> {
  const out = cloneSchemaNode(node);
  out[OPENAPI_X_OMNIA_CONVAI_OPTIONAL_SEMANTICS] = CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID;

  const t = typeof out.type === 'string' ? out.type.toLowerCase() : '';
  if (optional && (t === 'string' || t === '' || !t)) {
    out.description = appendDescriptionSuffix(out.description, OPENAPI_OPTIONAL_FIELD_DESCRIPTION_SUFFIX);
  }

  if (t === 'object' && isRecord(out.properties)) {
    const req = Array.isArray(out.required)
      ? new Set(out.required.map((x) => String(x ?? '').trim()).filter(Boolean))
      : new Set<string>();
    const props: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(out.properties)) {
      if (!isRecord(child)) {
        props[key] = child;
        continue;
      }
      const childOptional = optional || !req.has(key);
      props[key] = annotateOptionalSchemaNode(child, childOptional);
    }
    out.properties = props;
    if (optional) {
      out.description = appendDescriptionSuffix(
        out.description,
        ' Oggetto opzionale: omit o {} se nessun vincolo; sotto-campi con "" = assenti.'
      );
    }
  }

  if (t === 'array' && isRecord(out.items) && optional) {
    out.items = annotateOptionalSchemaNode(out.items, true);
  }

  return out;
}

/**
 * Arricchisce frammenti JSON Schema SEND (post Read API) con note ConvAI sui campi opzionali.
 */
export function enrichOpenApiInputSchemasForConvaiOptionalSemantics(
  schemasByApiName: Record<string, Record<string, unknown>>,
  requestBodyRequiredPropertyNames: readonly string[] | undefined,
  optionalApiParams: readonly string[] | undefined
): Record<string, Record<string, unknown>> {
  const requiredTop = new Set(
    (requestBodyRequiredPropertyNames ?? []).map((x) => String(x ?? '').trim()).filter(Boolean)
  );
  const optionalTop = new Set(
    (optionalApiParams ?? []).map((x) => String(x ?? '').trim()).filter(Boolean)
  );
  const out: Record<string, Record<string, unknown>> = {};
  for (const [apiName, fragment] of Object.entries(schemasByApiName)) {
    if (!isRecord(fragment)) {
      out[apiName] = fragment;
      continue;
    }
    const optional =
      optionalTop.has(apiName) || !requiredTop.has(apiName);
    out[apiName] = annotateOptionalSchemaNode(fragment, optional);
  }
  return out;
}

/** Righe preamble per contratto OpenAPI / USE OF BACKENDS. */
export function buildOpenApiConvaiContractPreambleLines(): string[] {
  return [
    '── Regola ConvAI (webhook ElevenLabs / gateway Omnia) ──',
    CONVAI_OPTIONAL_EMPTY_STRING_RULE_SHORT,
    `ID: ${CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID}`,
    'Obbligatorio per backend tool webhook: agenda-solver, next-window, BookFromAgenda e ogni API importata come tool ConvAI.',
  ];
}

/** Sezione report readiness (Markdown/plain). */
export function formatConvaiOptionalFieldSemanticsReportSection(): string[] {
  return [
    '── Standard API backend ConvAI (webhook) ──',
    CONVAI_OPTIONAL_EMPTY_STRING_RULE_SHORT,
    '',
    ...CONVAI_OPTIONAL_EMPTY_STRING_RULE_DOCUMENTATION.split('\n'),
    '',
  ];
}

/** Extension `info` consigliata per documenti OpenAPI Omnia-first. */
export function buildOpenApiInfoConvaiOptionalSemanticsExtension(): Record<string, unknown> {
  return {
    [OPENAPI_X_OMNIA_CONVAI_OPTIONAL_SEMANTICS]: {
      ruleId: CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID,
      summary: CONVAI_OPTIONAL_EMPTY_STRING_RULE_SHORT,
    },
  };
}
