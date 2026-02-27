// rebuild_clean_templates.js
// Ricostruisce 13 template dal JSON mostrato con struttura pulita

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// ✅ Template originali dal JSON che hai mostrato
const ORIGINAL_TEMPLATES = [
  {
    // 1. Number (type: 0 - SayMessage)
    _id: "691708f082f0c8d95d05b70c",
    id: "3a29c99b-1e0b-4d90-9a2f-f6f2f8fe2f6c",
    label: "Number",
    icon: "Phone",
    type: 0,
    name: "3a29c99b-1e0b-4d90-9a2f-f6f2f8fe2f6c",
    contexts: ["NodeRow"],
    dataContracts: [
      { type: "required" },
      { type: "minLength", value: 6 },
      { type: "maxLength", value: 15 }
    ],
    patterns: {
      IT: ["\\bnumber\\b"],
      EN: ["\\bnumber\\b"],
      PT: ["\\bnumber\\b"]
    },
    createdAt: "2025-12-28T08:34:34.209+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 2. Send SMS (type: 6)
    _id: "sendSMS-template",
    id: "a6422ac7-f897-4fd6-b0cf-a60ba99e8b30",
    label: "Send SMS",
    icon: "MessageSquare",
    color: "text-teal-500",
    description: "Sends an SMS to the user.",
    scope: "global",
    type: 6,
    name: "sendSMS-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:30.705+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 3. Read From Backend (type: 10)
    _id: "readFromBackend-template",
    id: "readFromBackend-template",
    label: "Read From Backend",
    icon: "Database",
    color: "text-cyan-500",
    description: "Reads data from the backend system.",
    scope: "global",
    type: 10,
    name: "readFromBackend-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:30.761+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 4. To Attendant (type: 8 - EscalateToHuman)
    _id: "escalateToHuman-template",
    id: "escalateToHuman-template",
    label: "To Attendant",
    icon: "Headphones",
    color: "text-green-500",
    description: "Escalates the conversation to a human agent.",
    scope: "global",
    type: 8,
    name: "escalateToHuman-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:30.834+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 5. Write to Backend (type: 11)
    _id: "writeToBackend-template",
    id: "writeToBackend-template",
    label: "Write to Backend",
    icon: "ServerCog",
    color: "text-blue-600",
    description: "Writes data to the backend system.",
    scope: "global",
    type: 11,
    name: "writeToBackend-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:30.910+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 6. Wait for Agent (type: 19)
    _id: "waitForAgent-template",
    id: "waitForAgent-template",
    label: "Wait for Agent",
    icon: "Clock",
    color: "text-lime-600",
    description: "Waits for a human agent to join.",
    scope: "global",
    type: 19,
    name: "waitForAgent-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:30.974+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 7. To Bot Guard (type: 9 - EscalateToGuardVR)
    _id: "escalateToGuardVR-template",
    id: "49f4b669-0215-4955-811a-91ab01363687",
    label: "To Bot Guard",
    icon: "Shield",
    color: "text-indigo-500",
    description: "Escalates the conversation to a virtual guard.",
    scope: "global",
    type: 9,
    name: "escalateToGuardVR-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.037+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 8. Hang Up (type: 16)
    _id: "hangUp-template",
    id: "9563e605-7c9f-4fe4-ab42-e0a65904ee70",
    label: "Hang Up",
    icon: "PhoneOff",
    color: "text-red-500",
    description: "Ends the call or conversation.",
    scope: "global",
    type: 16,
    name: "hangUp-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.100+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 9. Assign (type: 17)
    _id: "assign-template",
    id: "f90bfda0-2534-4c50-a433-626107faaff4",
    label: "Assign",
    icon: "Function",
    color: "text-violet-500",
    description: "Assigns a value to a variable.",
    scope: "global",
    type: 17,
    name: "assign-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.153+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 10. Play Jingle (type: 14)
    _id: "playJingle-template",
    id: "4e0c27cb-3286-4341-adb9-ab9d56d652db",
    label: "Play Jingle",
    icon: "Music",
    color: "text-pink-500",
    description: "Plays a jingle or audio clip.",
    scope: "global",
    type: 14,
    name: "playJingle-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.236+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 11. Clear (type: 18)
    _id: "clear-template",
    id: "fdcd8cc4-fe13-4fb5-885e-83443e2c8e1b",
    label: "Clear",
    icon: "Eraser",
    color: "text-gray-500",
    description: "Clears variables or state.",
    scope: "global",
    type: 18,
    name: "clear-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.312+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 12. Send Email (type: 7)
    _id: "sendEmail-template",
    id: "24c98977-2585-4215-ac46-922001a02c1a",
    label: "Send Email",
    icon: "Mail",
    color: "text-yellow-600",
    description: "Sends an email to the user.",
    scope: "global",
    type: 7,
    name: "sendEmail-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.462+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 13. Jump (type: 15)
    _id: "jump-template",
    id: "cf406ebb-007a-4f31-b671-1a180594a69c",
    label: "Jump",
    icon: "ArrowRight",
    color: "text-emerald-500",
    description: "Jumps to another block or state.",
    scope: "global",
    type: 15,
    name: "jump-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.535+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 14. Log Label (type: 13)
    _id: "logLabel-template",
    id: "25543b84-840f-4cbb-944e-e3d54d01aafe",
    label: "Log Label",
    icon: "Tag",
    color: "text-amber-500",
    description: "Logs a label for analytics or debugging.",
    scope: "global",
    type: 13,
    name: "logLabel-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.673+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  },
  {
    // 15. Log Data (type: 12)
    _id: "logData-template",
    id: "ea7ccaa5-e499-455d-8229-533efd70c7f8",
    label: "Log Data",
    icon: "Tag",
    color: "text-orange-500",
    description: "Logs data for analytics or debugging.",
    scope: "global",
    type: 12,
    name: "logData-template",
    contexts: ["NodeRow", "Response"],
    allowedContexts: ["escalation"],
    createdAt: "2025-11-14T21:17:31.620+00:00",
    updatedAt: "2026-02-12T18:28:38.498+00:00"
  }
];

/**
 * Costruisce template pulito con parametri appropriati per il tipo
 */
function buildCleanTemplate(original) {
  const type = original.type;
  if (type === undefined || type === null) {
    console.warn(`⚠️  Template ${original.id || original._id} ha type undefined`);
    return null;
  }

  // Base template con campi comuni
  const clean = {
    _id: original._id || original.id,
    id: original.id || original._id,
    type: type,
    templateId: null, // Template standalone
    label: original.label || 'Untitled',
    icon: original.icon || 'Circle',
    color: original.color || 'text-gray-500',
    description: original.description || '',
    scope: original.scope || 'global',
    name: original.name || undefined,
    allowedContexts: original.allowedContexts || original.contexts || [],
    createdAt: original.createdAt ? new Date(original.createdAt) : new Date(),
    updatedAt: new Date()
  };

  // ✅ Campi specifici per tipo
  switch (type) {
    case 0: // SayMessage
      // Mantieni dataContracts, patterns per Number
      if (original.dataContracts) clean.dataContracts = original.dataContracts;
      if (original.patterns) clean.patterns = original.patterns;
      clean.valueSchema = original.valueSchema || {};
      clean.contexts = original.contexts || [];
      break;

    case 6: // SendSMS
      clean.valueSchema = {
        keys: {
          to: { type: 'string', required: true },
          body: { type: 'string', required: true, multilang: true }
        }
      };
      clean.signature = {
        params: {
          to: { type: 'string', required: true },
          body: { type: 'string', required: true, multilang: true }
        }
      };
      break;

    case 7: // SendEmail
      clean.valueSchema = {
        keys: {
          to: { type: 'string', required: true },
          subject: { type: 'string', required: true, multilang: true },
          body: { type: 'string', required: true, multilang: true }
        }
      };
      clean.signature = {
        params: {
          to: { type: 'string', required: true },
          subject: { type: 'string', required: true, multilang: true },
          body: { type: 'string', required: true, multilang: true }
        }
      };
      break;

    case 8: // EscalateToHuman
      clean.valueSchema = {
        keys: {
          target: { type: 'string', required: false }
        }
      };
      clean.signature = {
        params: {
          target: { type: 'string', required: false }
        }
      };
      break;

    case 9: // EscalateToGuardVR
      clean.valueSchema = {
        keys: {
          target: { type: 'string', required: false }
        }
      };
      clean.signature = {
        params: {
          target: { type: 'string', required: false }
        }
      };
      break;

    case 10: // ReadFromBackend
      clean.valueSchema = {
        keys: {
          endpoint: { type: 'string', required: true }
        }
      };
      clean.signature = {
        params: {
          endpoint: { type: 'string', required: true }
        }
      };
      break;

    case 11: // WriteToBackend
      clean.valueSchema = {
        keys: {
          endpoint: { type: 'string', required: true },
          data: { type: 'object', required: true }
        }
      };
      clean.signature = {
        params: {
          endpoint: { type: 'string', required: true },
          data: { type: 'object', required: true }
        }
      };
      break;

    case 12: // LogData
      clean.valueSchema = {
        keys: {
          data: { type: 'object', required: true }
        }
      };
      clean.signature = {
        params: {
          data: { type: 'object', required: true }
        }
      };
      break;

    case 13: // LogLabel
      clean.valueSchema = {
        keys: {
          label: { type: 'string', required: true }
        }
      };
      clean.signature = {
        params: {
          label: { type: 'string', required: true }
        }
      };
      break;

    case 14: // PlayJingle
      clean.valueSchema = {
        keys: {
          url: { type: 'string', required: true, multilang: true, multistyle: true }
        }
      };
      clean.signature = {
        params: {
          url: { type: 'string', required: true, multilang: true, multistyle: true }
        }
      };
      break;

    case 15: // Jump
      clean.valueSchema = {
        keys: {
          target: { type: 'string', required: true }
        }
      };
      clean.signature = {
        params: {
          target: { type: 'string', required: true }
        }
      };
      break;

    case 16: // HangUp
      clean.valueSchema = {};
      clean.signature = { params: {} };
      break;

    case 17: // Assign
      clean.valueSchema = {
        keys: {
          key: { type: 'string', required: true },
          value: { type: 'string', required: true }
        }
      };
      clean.signature = {
        params: {
          key: { type: 'string', required: true },
          value: { type: 'string', required: true }
        }
      };
      break;

    case 18: // Clear
      clean.valueSchema = {};
      clean.signature = { params: {} };
      break;

    case 19: // WaitForAgent
      clean.valueSchema = {};
      clean.signature = { params: {} };
      break;

    default:
      clean.valueSchema = original.valueSchema || {};
      break;
  }

  // ❌ RIMUOVI steps da tutti i task (nessuno è di tipo 3)
  if (clean.steps) {
    delete clean.steps;
  }

  return clean;
}

/**
 * Salva traduzioni per un template (IT, EN, PT)
 */
async function saveTranslations(client, templateId, label) {
  const db = client.db(dbFactory);
  const translationsColl = db.collection('Translations');

  const now = new Date();
  const languages = ['it', 'en', 'pt'];

  // Traduzioni specifiche per alcuni template
  const specificTranslations = {
    'To Attendant': { it: 'All\'operatore', en: 'To Attendant', pt: 'Para o Atendente' },
    'To Bot Guard': { it: 'Al Guard VR', en: 'To Bot Guard', pt: 'Para o Guard VR' },
    'Wait for Agent': { it: 'Attendi operatore', en: 'Wait for Agent', pt: 'Aguarde o Agente' },
    'Hang Up': { it: 'Chiudi', en: 'Hang Up', pt: 'Desligar' },
    'Play Jingle': { it: 'Tocca Jingle', en: 'Play Jingle', pt: 'Tocar Jingle' },
    'Clear': { it: 'Pulisci', en: 'Clear', pt: 'Limpar' },
    'Send Email': { it: 'Invia Email', en: 'Send Email', pt: 'Enviar Email' },
    'Jump': { it: 'Salta', en: 'Jump', pt: 'Saltar' },
    'Log Label': { it: 'Log Etichetta', en: 'Log Label', pt: 'Log Etiqueta' },
    'Log Data': { it: 'Log Dati', en: 'Log Data', pt: 'Log Dados' },
    'Read From Backend': { it: 'Leggi dal Backend', en: 'Read From Backend', pt: 'Ler do Backend' },
    'Write to Backend': { it: 'Scrivi sul Backend', en: 'Write to Backend', pt: 'Escrever no Backend' },
    'Send SMS': { it: 'Invia SMS', en: 'Send SMS', pt: 'Enviar SMS' },
    'Number': { it: 'Numero', en: 'Number', pt: 'Número' },
    'Assign': { it: 'Assegna', en: 'Assign', pt: 'Atribuir' }
  };

  const translations = languages.map(lang => {
    const specific = specificTranslations[label];
    const text = specific ? specific[lang] : label;

    return {
      guid: templateId,
      language: lang,
      text: text,
      type: 'Label',
      projectId: null, // Factory translations
      createdAt: now,
      updatedAt: now
    };
  });

  // Salva traduzioni
  for (const trans of translations) {
    await translationsColl.updateOne(
      {
        guid: trans.guid,
        language: trans.language,
        type: trans.type,
        projectId: null
      },
      {
        $set: {
          guid: trans.guid,
          language: trans.language,
          text: trans.text,
          type: trans.type,
          projectId: null,
          updatedAt: trans.updatedAt
        },
        $setOnInsert: {
          createdAt: trans.createdAt
        }
      },
      { upsert: true }
    );
  }
}

/**
 * Ricostruisce tutti i template dal JSON originale
 */
async function rebuildTemplatesFromJson() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);
    const tasksColl = db.collection('tasks');

    console.log(`📋 Ricostruendo ${ORIGINAL_TEMPLATES.length} template...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const original of ORIGINAL_TEMPLATES) {
      try {
        const clean = buildCleanTemplate(original);

        if (!clean) {
          console.warn(`⚠️  Saltato template ${original.id || original._id}`);
          errorCount++;
          continue;
        }

        // Salva template pulito
        await tasksColl.updateOne(
          { _id: clean._id },
          { $set: clean },
          { upsert: true }
        );

        // Salva traduzioni per la label
        await saveTranslations(client, clean.id, clean.label);

        console.log(`✅ ${clean.label} (type: ${clean.type}, icon: ${clean.icon})`);
        successCount++;

      } catch (error) {
        console.error(`❌ Errore su ${original.label || original.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Riepilogo:`);
    console.log(`   ✅ Template ricostruiti: ${successCount}`);
    console.log(`   ❌ Errori: ${errorCount}`);
    console.log(`   🔑 Traduzioni create: ${successCount * 3} (IT, EN, PT per ogni template)`);

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui script
if (require.main === module) {
  rebuildTemplatesFromJson()
    .then(() => {
      console.log('\n✅ Script completato');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Errore:', error);
      process.exit(1);
    });
}

module.exports = { rebuildTemplatesFromJson, buildCleanTemplate };
