import { DataNodeV2 } from './types';
import { v4 as uuidv4 } from 'uuid';

// Helper per normalizzare la label inglese in un prefisso umano (camelCase, senza spazi)
function normalizeLabel(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/\s/g, '')
    .replace(/^(.)/, (_, chr) => chr.toLowerCase());
}

// Helper per generare chiavi parlanti per constraint
function makeConstraintKeys(prefix: string, guid: string, type: string): { label: string; payoff: string; message: string } {
  const base = `${prefix}_${type}_${guid.slice(0, 8)}`;
  return {
    label: `${base}_label`,
    payoff: `${base}_payoff`,
    message: `${base}_msg`,
  };
}

// Factory principale per DataNodeV2
export interface CreateDataNodeV2Params {
  labelEn: string;
  type: string;
  variableName?: string;
  descriptionKey?: string;
  variableDescriptionKey?: string;
  constraints?: any[];
  subData?: CreateDataNodeV2Params[];
}

export function createDataNodeV2(params: CreateDataNodeV2Params): DataNodeV2 {
  const guid = uuidv4();
  const prefix = normalizeLabel(params.labelEn);
  const id = `${prefix}_${guid}`;
  const labelKey = `${prefix}_label_${guid}`;
  const descriptionKey = params.descriptionKey || `${prefix}_desc_${guid}`;
  const variableId = params.variableName ? `${params.variableName}_${guid}` : undefined;
  const variableLabelKey = params.variableName ? `${params.variableName}_var_label_${guid}` : undefined;
  const variableDescriptionKey = params.variableDescriptionKey || (params.variableName ? `${params.variableName}_var_desc_${guid}` : undefined);

  // Generate constraint keys with full GUID
  const constraints = params.constraints?.map((c, idx) => {
    const cGuid = uuidv4();
    const cPrefix = params.variableName ? normalizeLabel(params.variableName) : prefix;
    const keys = {
      label: `${cPrefix}_${c.type}_${cGuid}_label`,
      payoff: `${cPrefix}_${c.type}_${cGuid}_payoff`,
      message: `${cPrefix}_${c.type}_${cGuid}_msg`,
    };
    return {
      ...c,
      label: keys.label,
      payoff: keys.payoff,
      message: keys.message,
    };
  });

  return {
    id,
    label: labelKey,
    description: descriptionKey,
    type: params.type,
    variable: params.variableName
      ? {
          id: variableId!,
          label: variableLabelKey!,
          description: variableDescriptionKey,
        }
      : undefined,
    constraints,
    subData: params.subData?.map(child => createDataNodeV2(child)),
  };
}

// Esempio pratico: DDT carta di credito
export const creditCardDDTExample = createDataNodeV2({
  labelEn: 'Credit Card',
  type: 'object',
  variableName: 'creditCard',
  subData: [
    {
      labelEn: 'Card number',
      type: 'string',
      variableName: 'cardNumber',
      constraints: [
        {
          type: 'regex',
          pattern: '^[0-9]{16}$',
        },
      ],
    },
    {
      labelEn: 'Expiry',
      type: 'date',
      variableName: 'expiry',
      constraints: [
        {
          type: 'futureDate',
        },
      ],
    },
    {
      labelEn: 'CVC',
      type: 'string',
      variableName: 'cvc',
      constraints: [
        {
          type: 'regex',
          pattern: '^[0-9]{3,4}$',
        },
      ],
    },
    {
      labelEn: 'Holder',
      type: 'string',
      variableName: 'holder',
    },
  ],
}); 