// Simple multilingual, rule-based classifier for Task interactivity
// Returns true if the title implies the agent asks/requests user data; false if it's purely emissive;
// undefined if no strong signal.

export function classifyTaskInteractivity(title?: string): boolean | undefined {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return undefined;

  // Interactive cues (EN/IT/ES + common verbs)
  const interactiveRe = /(ask(s)?|request(s|ed)?|require(s|d)?|collect(s|ed)?|verify(ing|ies|ied)?|confirm(s|ed)?|prompt(s|ed)?|solicit(s|ed)?|chiede|richiede|domanda|raccoglie|verifica|conferma|sollecita|pregunta|solicita|solicitar|pide|pedir)/i;
  // Emissive cues
  const emissiveRe = /(say(s|ing)?|inform(s|ed|ing)?|notify(ing|ies|ied)?|communicat(e|es|ed|ing)|announce(s|d|ing)?|explain(s|ed)?|dice|informa|notifica|comunica|annuncia)/i;

  const hasInteractive = interactiveRe.test(t) || /(ask|asks).*for\b/i.test(t);
  const hasEmissive = emissiveRe.test(t);

  if (hasInteractive && !hasEmissive) return true;
  if (!hasInteractive && hasEmissive) return false;
  if (hasInteractive && hasEmissive) return true; // prefer interactive if ambiguous

  // Heuristics: phrases like "ask for user's ...", "request ...", "user's personal data"
  if (/\b(ask|asks|request|requests)\b.*\b(user|utente|usuario)(?:'s)?\b/i.test(t)) return true;
  if (/personal data|user data|dati personali|datos personales/i.test(t) && /ask|asks|request|requests|chiede|richiede|solicita/i.test(t)) return true;

  return undefined;
}

// Extended classifier that determines the specific mode (DataRequest, DataConfirmation, Message)
export function classifyTaskMode(title?: string): 'DataRequest' | 'DataConfirmation' | 'Message' {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return 'Message';

  // DataConfirmation cues - agent confirms/verifies user data
  const confirmationRe = /(confirm(s|ed|ing)?|verify(ing|ies|ied)?|check(s|ed|ing)?|validate(s|d|ing)?|check.*correct|verify.*correct|conferma|verifica|controlla|valida|ask.*confirm|ask.*verification|ask.*check|request.*confirm|request.*verification|request.*check)/i;

  // DataRequest cues - agent asks for user data (più robusto)
  const requestRe = /(ask(s)?.*for|request(s|ed)?|require(s|d)?|collect(s|ed)?|prompt(s|ed)?|solicit(s|ed)?|chiede.*per|richiede|domanda.*per|raccoglie|sollecita|pregunta.*por|solicita|pide.*por|get(s|ting)?|need(s|ing)?|obtain(s|ing)?|acquire(s|ing)?|gather(s|ing)?|fetch(es|ing)?)/i;

  // Message cues - agent provides information
  const messageRe = /(say(s|ing)?|inform(s|ed|ing)?|notify(ing|ies|ied)?|communicat(e|es|ed|ing)|announce(s|d|ing)?|explain(s|ed)?|dice|informa|notifica|comunica|annuncia|spiega)/i;

  const hasConfirmation = confirmationRe.test(t);

  // Semplice e robusto: cerca parole chiave + qualsiasi cosa dopo, ma escludi confirmation
  const hasRequest = requestRe.test(t) ||
    // Pattern "ask" + qualsiasi cosa (ma non "ask confirmation")
    (/\b(ask|asks)\b.*\w+/i.test(t) && !/\b(ask|asks)\b.*\b(confirm|confirmation|verify|verification|check|validate|validation)\b/i.test(t)) ||
    // Pattern "ask for" + qualsiasi cosa (ma non "ask for confirmation")
    (/\b(ask|asks)\s+for\b.*\w+/i.test(t) && !/\b(ask|asks)\s+for\b.*\b(confirm|confirmation|verify|verification|check|validate|validation)\b/i.test(t)) ||
    // Pattern "solicit" + qualsiasi cosa
    /\b(solicit|solicits|soliciting)\b.*\w+/i.test(t) ||
    // Pattern "request" + qualsiasi cosa (ma non "request confirmation")
    (/\b(request|requests|requesting)\b.*\w+/i.test(t) && !/\b(request|requests|requesting)\b.*\b(confirm|confirmation|verify|verification|check|validate|validation)\b/i.test(t)) ||
    // Pattern "get" + qualsiasi cosa
    /\b(get|gets|getting)\b.*\w+/i.test(t) ||
    // Pattern "collect" + qualsiasi cosa
    /\b(collect|collects|collecting)\b.*\w+/i.test(t) ||
    // Pattern "need" + qualsiasi cosa
    /\b(need|needs|needing)\b.*\w+/i.test(t) ||
    // Pattern "require" + qualsiasi cosa
    /\b(require|requires|requiring)\b.*\w+/i.test(t) ||
    // Pattern "prompt" + qualsiasi cosa
    /\b(prompt|prompts|prompting)\b.*\w+/i.test(t);

  const hasMessage = messageRe.test(t);

  // Priority order: DataConfirmation > DataRequest > Message
  if (hasConfirmation && !hasRequest) return 'DataConfirmation';
  if (hasRequest && !hasConfirmation) return 'DataRequest';
  if (hasMessage && !hasRequest && !hasConfirmation) return 'Message';

  // Ambiguous cases - use heuristics
  if (hasConfirmation && hasRequest) return 'DataConfirmation'; // prefer confirmation if both
  if (hasRequest && hasMessage) return 'DataRequest'; // prefer request if both

  // Fallback heuristics for common patterns
  if (/\b(ask|asks|request|requests)\b.*\b(user|utente|usuario)(?:'s)?\b/i.test(t)) return 'DataRequest';
  if (/personal data|user data|dati personali|datos personales/i.test(t) && /ask|asks|request|requests|chiede|richiede|solicita/i.test(t)) return 'DataRequest';

  // Default fallback
  return 'Message';
}