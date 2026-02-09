/**
 * Script per generare sinonimi euristici per tutti i task nel database factory
 *
 * Per ogni task (atomico, composito, aggregato):
 * 1. Analizza il label del task
 * 2. Genera sinonimi ragionevoli in IT, EN, PT
 * 3. Inserisce nella collection Translations con:
 *    - guid: template.id
 *    - language: "it" | "en" | "pt"
 *    - synonyms: ["sinonimo1", "sinonimo2", ...]
 *    - Use: "Heuristics"
 *    - Find: "TaskTemplate"
 *    - projectId: null
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';
const LANGUAGES = ['it', 'en', 'pt'];

/**
 * Genera sinonimi per un template basandosi sul label
 * Usa regole euristiche + traduzioni cross-lingua
 */
function generateSynonymsForTemplate(templateLabel) {
  const label = (templateLabel || '').toLowerCase().trim();

  // Mappa sinonimi comuni per concetti base
  const baseSynonyms = {
    // Date components
    'day': {
      it: ['giorno', 'giorno di nascita', 'giorno del mese', 'giorno della data', 'giorno di nascita del paziente', 'giorno di nascita del cliente'],
      en: ['day', 'birth day', 'day of month', 'day of date', 'day of birth of patient', 'day of birth of customer'],
      pt: ['dia', 'dia de nascimento', 'dia do mês', 'dia da data', 'dia de nascimento do paciente', 'dia de nascimento do cliente']
    },
    'month': {
      it: ['mese', 'mese di nascita', 'mese dell\'anno', 'mese della data', 'mese di nascita del paziente', 'mese di nascita del cliente'],
      en: ['month', 'birth month', 'month of year', 'month of date', 'month of birth of patient', 'month of birth of customer'],
      pt: ['mês', 'mês de nascimento', 'mês do ano', 'mês da data', 'mês de nascimento do paciente', 'mês de nascimento do cliente']
    },
    'year': {
      it: ['anno', 'anno di nascita', 'anno della data', 'anno di nascita del paziente', 'anno di nascita del cliente'],
      en: ['year', 'birth year', 'year of date', 'year of birth of patient', 'year of birth of customer'],
      pt: ['ano', 'ano de nascimento', 'ano da data', 'ano de nascimento do paciente', 'ano de nascimento do cliente']
    },
    'date': {
      it: ['data', 'data di nascita', 'data di nascita del paziente', 'data di nascita del cliente', 'data di nascita del titolare', 'data di nascita del titolare della clinica'],
      en: ['date', 'date of birth', 'birth date', 'date of birth of patient', 'date of birth of customer', 'date of birth of owner', 'date of birth of clinic owner'],
      pt: ['data', 'data de nascimento', 'data de nascimento do paciente', 'data de nascimento do cliente', 'data de nascimento do titular', 'data de nascimento do titular da clínica']
    },
    // Name components
    'first name': {
      it: ['nome', 'nome di battesimo', 'nome proprio', 'nome del paziente', 'nome del cliente', 'nome del titolare'],
      en: ['first name', 'given name', 'forename', 'first name of patient', 'first name of customer', 'first name of owner'],
      pt: ['nome', 'nome próprio', 'primeiro nome', 'nome do paciente', 'nome do cliente', 'nome do titular']
    },
    'last name': {
      it: ['cognome', 'nome di famiglia', 'cognome del paziente', 'cognome del cliente', 'cognome del titolare'],
      en: ['last name', 'surname', 'family name', 'last name of patient', 'last name of customer', 'last name of owner'],
      pt: ['sobrenome', 'apelido', 'sobrenome do paciente', 'sobrenome do cliente', 'sobrenome do titular']
    },
    'full name': {
      it: ['nome completo', 'nome e cognome', 'nome completo del paziente', 'nome completo del cliente', 'nome completo del titolare'],
      en: ['full name', 'complete name', 'full name of patient', 'full name of customer', 'full name of owner'],
      pt: ['nome completo', 'nome e sobrenome', 'nome completo do paciente', 'nome completo do cliente', 'nome completo do titular']
    },
    // Address components
    'street': {
      it: ['via', 'strada', 'via di residenza', 'indirizzo', 'via del paziente', 'via del cliente'],
      en: ['street', 'street address', 'street name', 'street of patient', 'street of customer'],
      pt: ['rua', 'endereço', 'nome da rua', 'rua do paciente', 'rua do cliente']
    },
    'city': {
      it: ['città', 'comune', 'città di residenza', 'città del paziente', 'città del cliente'],
      en: ['city', 'town', 'city of residence', 'city of patient', 'city of customer'],
      pt: ['cidade', 'município', 'cidade de residência', 'cidade do paciente', 'cidade do cliente']
    },
    'postal code': {
      it: ['cap', 'codice postale', 'cap di residenza', 'cap del paziente', 'cap del cliente'],
      en: ['postal code', 'zip code', 'postcode', 'postal code of patient', 'postal code of customer'],
      pt: ['cep', 'código postal', 'cep de residência', 'cep do paciente', 'cep do cliente']
    },
    // Contact
    'email': {
      it: ['email', 'indirizzo email', 'posta elettronica', 'email del paziente', 'email del cliente', 'email del titolare'],
      en: ['email', 'email address', 'e-mail', 'email of patient', 'email of customer', 'email of owner'],
      pt: ['email', 'endereço de email', 'e-mail', 'email do paciente', 'email do cliente', 'email do titular']
    },
    'phone': {
      it: ['telefono', 'numero di telefono', 'cellulare', 'telefono del paziente', 'telefono del cliente', 'telefono del titolare'],
      en: ['phone', 'phone number', 'telephone', 'phone of patient', 'phone of customer', 'phone of owner'],
      pt: ['telefone', 'número de telefone', 'celular', 'telefone do paciente', 'telefone do cliente', 'telefone do titular']
    },
    'phone number': {
      it: ['numero di telefono', 'telefono', 'cellulare', 'numero del paziente', 'numero del cliente'],
      en: ['phone number', 'telephone number', 'phone', 'phone number of patient', 'phone number of customer'],
      pt: ['número de telefone', 'telefone', 'celular', 'número do paciente', 'número do cliente']
    }
  };

  // Cerca match esatto o parziale nel label
  for (const [key, synonyms] of Object.entries(baseSynonyms)) {
    if (label.includes(key)) {
      return synonyms;
    }
  }

  // ❌ NESSUN FALLBACK: se non troviamo sinonimi specifici, non matchiamo
  return { it: [], en: [], pt: [] };
}

/**
 * Classifica un template
 */
function classifyTemplate(template) {
  const hasSubDataIds = template.subDataIds && Array.isArray(template.subDataIds) && template.subDataIds.length > 0;
  const hasSubData = template.subData && (Array.isArray(template.subData) ? template.subData.length > 0 : Object.keys(template.subData || {}).length > 0);

  if (!hasSubDataIds && !hasSubData) {
    return 'Atomic';
  }
  if (hasSubDataIds || hasSubData) {
    return 'CompositeData';
  }
  return 'Unknown';
}

/**
 * Main function
 */
async function generateHeuristicsSynonyms() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_FACTORY);
    const tasksCollection = db.collection('Tasks');
    const translationsCollection = db.collection('Translations');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔧 GENERAZIONE SINONIMI EURISTICI');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Carica tutti i task DataRequest (type: 3)
    const allTasks = await tasksCollection.find({ type: 3 }).toArray();
    console.log(`📊 Trovati ${allTasks.length} task DataRequest\n`);

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const task of allTasks) {
      const taskId = task.id || task._id?.toString();
      const taskLabel = task.label || task.name || 'Unknown';
      const classification = classifyTemplate(task);

      if (!taskId) {
        console.log(`⚠️  Skipping task without ID: ${taskLabel}`);
        skippedCount++;
        continue;
      }

      console.log(`\n📦 Processing: ${taskLabel} (${classification})`);
      console.log(`   ID: ${taskId}`);

      // Genera sinonimi
      const synonymsByLang = generateSynonymsForTemplate(taskLabel);

      // Inserisci per ogni lingua
      for (const lang of LANGUAGES) {
        const synonyms = synonymsByLang[lang] || [];
        if (synonyms.length === 0) {
          console.log(`   ⚠️  ${lang}: No synonyms generated`);
          continue;
        }

        // Usa updateOne con upsert per gestire sia inserimenti che aggiornamenti
        // L'indice è su guid_1_language_1_type_1_projectId_1, quindi dobbiamo usare quella combinazione come filtro
        try {
          // Filtro basato sulle chiavi dell'indice (senza Use/Find per trovare documenti esistenti)
          const indexFilter = {
            guid: taskId,
            language: lang,
            projectId: null,
            $or: [
              { type: null },
              { type: { $exists: false } }
            ]
          };

          // Verifica se esiste già un documento con questa combinazione di chiavi
          const existing = await translationsCollection.findOne(indexFilter);

          if (existing) {
            // Se esiste, aggiornalo aggiungendo/modificando Use, Find e synonyms
            const result = await translationsCollection.updateOne(
              { _id: existing._id },
              {
                $set: {
                  synonyms: synonyms,
                  Use: 'Heuristics',
                  Find: 'TaskTemplate',
                  updatedAt: new Date()
                }
              }
            );

            if (result.modifiedCount > 0) {
              console.log(`   🔄 ${lang}: Updated ${synonyms.length} synonyms`);
              updatedCount++;
            } else {
              console.log(`   ⏭️  ${lang}: Already exists, no changes needed`);
            }
          } else {
            // Se non esiste, inserisci nuovo documento
            const result = await translationsCollection.insertOne({
              guid: taskId,
              language: lang,
              synonyms: synonyms,
              Use: 'Heuristics',
              Find: 'TaskTemplate',
              projectId: null,
              type: null, // ✅ Esplicito per rispettare l'indice
              createdAt: new Date(),
              updatedAt: new Date()
            });

            if (result.insertedId) {
              console.log(`   ✅ ${lang}: ${synonyms.length} synonyms inserted`);
              console.log(`      ${synonyms.slice(0, 3).join(', ')}${synonyms.length > 3 ? '...' : ''}`);
              insertedCount++;
            }
          }
        } catch (err) {
          console.error(`   ❌ ${lang}: Error upserting synonyms:`, err.message);
          errorCount++;
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Inserted: ${insertedCount} synonym sets`);
    console.log(`🔄 Updated: ${updatedCount} synonym sets`);
    console.log(`⏭️  Skipped: ${skippedCount} tasks`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Esegui
generateHeuristicsSynonyms().catch(console.error);
