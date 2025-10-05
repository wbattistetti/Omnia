// Service per classificare automaticamente se un elemento è globale o specifico dell'industry
// Basato su analisi di esperti per cataloghi riutilizzabili

export type Scope = 'global' | 'industry' | 'project';
export type Industry = 'travel' | 'energy' | 'finance' | 'telco' | 'health' | 'retail' | 'utility-gas';

export interface ScopeGuess {
  scope: Scope;
  industry?: Industry;
  confidence: number;
  hits: Array<{
    industry: string;
    token: string;
    weight: number;
  }>;
  rationale?: string;
}

// Dizionario di token settoriali con pesi (basato sul design dell'esperto)
const INDUSTRY_TOKENS: Record<Industry, Record<string, number>> = {
  travel: {
    iata: 2.2, icao: 1.8, pnr: 1.8, volo: 0.8, aeroporto: 0.9, gate: 0.8, boarding: 0.8, scalo: 0.8, layover: 0.8,
    partenza: 0.7, arrivo: 0.7, biglietto: 0.6, prenotazione: 0.6, checkin: 0.7, bagaglio: 0.6
  },
  energy: {
    kwh: 2.2, mwh: 1.2, pod: 2.2, contatore: 1.6, autolettura: 1.8, 'tariffa bioraria': 1.5, consumo: 0.8,
    fornitura: 0.8, bolletta: 0.7, utenza: 0.6, distributore: 0.7, 'punto di prelievo': 1.0
  },
  'utility-gas': {
    kwh: 2.2, mwh: 1.2, pod: 2.2, contatore: 1.6, autolettura: 1.8, 'tariffa bioraria': 1.5, consumo: 0.8,
    fornitura: 0.8, bolletta: 0.7, utenza: 0.6, distributore: 0.7, 'punto di prelievo': 1.0, gas: 1.5, metano: 1.3,
    'numero cliente': 1.2, 'codice utenza': 1.1, 'lettura contatore': 1.4
  },
  finance: {
    iban: 2.2, swift: 1.8, bic: 1.5, sepa: 1.5, kyc: 1.8, aml: 1.3, bonifico: 1.0, conto: 0.7, carta: 0.6,
    pagamento: 0.5, transazione: 0.6, 'codice fiscale': 0.8
  },
  telco: {
    imei: 2.2, iccid: 2.0, apn: 1.6, mnp: 1.6, portabilita: 1.6, sim: 0.9, numero: 0.5, chiamata: 0.5, sms: 0.5,
    traffico: 0.6, 'piano tariffario': 0.8
  },
  health: {
    'icd-10': 2.0, triage: 1.3, ricetta: 1.0, prescrizione: 0.9, medico: 0.6, paziente: 0.6, diagnosi: 0.7,
    terapia: 0.6, farmaco: 0.7, 'codice fiscale': 0.5
  },
  retail: {
    sku: 2.0, ean: 1.7, picking: 1.2, tracking: 1.2, corriere: 0.9, spedizione: 0.7, magazzino: 0.8,
    prodotto: 0.5, ordine: 0.6, carrello: 0.6, catalogo: 0.5
  }
};

// Token globali (cross-industry)
const GLOBAL_TOKENS = [
  'nome', 'cognome', 'email', 'telefono', 'indirizzo', 'citta', 'cap', 'data', 'ora', 'ora', 'tempo',
  'conferma', 'verifica', 'controlla', 'valida', 'salva', 'elimina', 'modifica', 'aggiorna', 'cerca',
  'filtra', 'ordina', 'esporta', 'importa', 'login', 'logout', 'registra', 'password', 'username',
  'profilo', 'impostazioni', 'preferenze', 'notifica', 'messaggio', 'errore', 'successo', 'avviso'
];

function normalize(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyScopeFromLabel(label: string, projectIndustry?: Industry): ScopeGuess {
  const normalizedLabel = normalize(label);
  const words = normalizedLabel.split(' ');
  
  let maxScore = 0;
  let bestIndustry: Industry | undefined;
  const hits: Array<{ industry: string; token: string; weight: number }> = [];
  
  // Controlla token globali
  const globalHits = words.filter(word => GLOBAL_TOKENS.includes(word));
  const globalScore = globalHits.length * 0.5;
  
  // Controlla token settoriali
  for (const [industry, tokens] of Object.entries(INDUSTRY_TOKENS)) {
    let industryScore = 0;
    const industryHits: Array<{ industry: string; token: string; weight: number }> = [];
    
    for (const [token, weight] of Object.entries(tokens)) {
      if (normalizedLabel.includes(token)) {
        industryScore += weight;
        industryHits.push({ industry, token, weight });
      }
    }
    
    if (industryScore > maxScore) {
      maxScore = industryScore;
      bestIndustry = industry as Industry;
      hits.length = 0;
      hits.push(...industryHits);
    }
  }
  
  // Determina scope e confidence
  let scope: Scope;
  let confidence: number;
  let rationale: string;
  
  if (globalScore > maxScore && globalScore > 1.0) {
    scope = 'global';
    confidence = Math.min(globalScore / 2, 1.0);
    rationale = `Global tokens detected: ${globalHits.join(', ')}`;
  } else if (maxScore > 1.5) {
    scope = 'industry';
    confidence = Math.min(maxScore / 3, 1.0);
    rationale = `Industry-specific tokens detected for ${bestIndustry}: ${hits.map(h => h.token).join(', ')}`;
  } else if (projectIndustry && maxScore > 0.5) {
    // Se abbiamo un'industry del progetto e qualche indicazione, usiamo quella
    scope = 'industry';
    bestIndustry = projectIndustry;
    confidence = Math.min(maxScore / 2, 0.7);
    rationale = `Project industry context: ${projectIndustry}`;
  } else {
    // Default: industry con l'industry del progetto o utility-gas
    scope = 'industry';
    bestIndustry = projectIndustry || 'utility-gas';
    confidence = 0.3;
    rationale = 'Default classification based on project context';
  }
  
  return {
    scope,
    industry: bestIndustry,
    confidence,
    hits,
    rationale
  };
}

export function getIndustryDisplayName(industry: Industry): string {
  const names: Record<Industry, string> = {
    travel: 'Travel & Tourism',
    energy: 'Energy',
    'utility-gas': 'Utility Gas',
    finance: 'Finance & Banking',
    telco: 'Telecommunications',
    health: 'Healthcare',
    retail: 'Retail & E-commerce'
  };
  return names[industry] || industry;
}

export function getIndustryColor(industry: Industry): string {
  const colors: Record<Industry, string> = {
    travel: '#3B82F6', // blue
    energy: '#F59E0B', // amber
    'utility-gas': '#10B981', // emerald
    finance: '#8B5CF6', // violet
    telco: '#EF4444', // red
    health: '#EC4899', // pink
    retail: '#06B6D4' // cyan
  };
  return colors[industry] || '#6B7280'; // gray fallback
}

export function getScopeColor(scope: Scope): string {
  const colors: Record<Scope, string> = {
    global: '#10B981', // emerald
    industry: '#F59E0B', // amber
    project: '#8B5CF6' // violet
  };
  return colors[scope] || '#6B7280';
}

export function getScopeIcon(scope: Scope): string {
  const icons: Record<Scope, string> = {
    global: '🌍',
    industry: '🏭',
    project: '📁'
  };
  return icons[scope] || '❓';
}
