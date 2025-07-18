const fs = require('fs');
const path = require('path');

// Percorsi dei file
const agentActsPath = path.join(__dirname, 'data/templates/utility_gas/agent_acts/en.json');
const userActsPath = path.join(__dirname, 'data/templates/utility_gas/user_acts/en.json');
const outputPath = path.join(__dirname, 'data/templates/utility_gas/agent_acts/agentActs_augmented.json');

// Carica i dati
const agentActs = JSON.parse(fs.readFileSync(agentActsPath, 'utf8'));
const userActs = JSON.parse(fs.readFileSync(userActsPath, 'utf8'));

// Funzione di matching fuzzy semplice
function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
}
function isMatch(agent, user) {
  // Cerca corrispondenza tra le parole chiave di domanda/richiesta e risposta
  const agentFields = [agent.name, agent.discursive, ...(agent.examples || [])].map(normalize).join(' ');
  const userFields = [user.name, user.discursive, ...(user.examples || [])].map(normalize).join(' ');

  // Esempi di matching: nome, codice fiscale, telefono, email, indirizzo, pod/pdr, consumo, accettazione, rifiuto, ecc.
  const keywords = [
    ['name', 'nome'],
    ['tax code', 'codice fiscale'],
    ['phone', 'telefono', 'cell'],
    ['email', 'mail'],
    ['address', 'indirizzo'],
    ['pod', 'pdr'],
    ['consumption', 'consumo'],
    ['meter power', 'potenza'],
    ['solar', 'fotovoltaico', 'pannelli'],
    ['accept', 'accettazione', 'ok', 'proceed'],
    ['refuse', 'rifiuto', 'no'],
    ['bonus', 'incentivo'],
    ['payment', 'pagamento'],
    ['privacy', 'consenso'],
    ['recording', 'registrazione'],
    ['clarification', 'chiarimento', 'spiegazione'],
    ['duration', 'durata'],
    ['cost', 'costo', 'prezzo'],
    ['documentation', 'documentazione', 'contratto'],
    ['members', 'componenti', 'persone'],
    ['time slots', 'fasce'],
    ['heating', 'riscaldamento'],
    ['alternative', 'alternativa'],
    ['objection', 'obiezione'],
    ['offer', 'offerta'],
    ['activation', 'attivazione'],
    ['bonus', 'incentivo'],
  ];

  for (const group of keywords) {
    if (group.some(k => agentFields.includes(k)) && group.some(k => userFields.includes(k))) {
      return true;
    }
  }

  // Fallback: se l'Agent Act contiene "ask", "provide", "can you", "could you", "do you have", "what is", "how many", "is", "are", "please", "would you"
  if (
    /(ask|provide|can you|could you|do you have|what is|how many|is |are |please|would you)/.test(agentFields) &&
    /(provide|my |yes|no|the |is |are |i )/.test(userFields)
  ) {
    return true;
  }

  return false;
}

// Per ogni Agent Act, trova i possibili User Acts attesi
const augmented = agentActs.map(agent => {
  const expected = userActs
    .filter(user => isMatch(agent, user))
    .map(user => user.id);

  return {
    ...agent,
    userActsExpected: expected
  };
});

// Scrivi il file di output
fs.writeFileSync(outputPath, JSON.stringify(augmented, null, 2), 'utf8');
console.log(`Creato agentActs_augmented.json con ${augmented.length} atti!`); 