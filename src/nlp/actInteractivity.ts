// Simple multilingual, rule-based classifier for Agent Act interactivity
// Returns true if the title implies the agent asks/requests user data; false if it's purely emissive;
// undefined if no strong signal.

export function classifyActInteractivity(title?: string): boolean | undefined {
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


