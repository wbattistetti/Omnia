/**
 * Migration: nlpContract → dataContract
 *
 * Converte completamente da nlpContract a dataContract:
 * 1. Struttura legacy (regex/rules/llm/ner a root) → dataContract
 * 2. Struttura nuova (methods + escalationOrder) → dataContract
 *
 * IMPORTANTE:
 * - Mantiene TUTTE le informazioni (enabled, patterns, extractorCode, ecc.)
 * - Ordine: escalationOrder se presente, altrimenti ordine naturale
 * - Solo metodi con enabled !== false vengono inclusi
 * - Rimuove nlpContract dopo la conversione
 *
 * Esegui con: node backend/migrations/migrate_nlpcontract_to_datacontract.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

/**
 * Converte nlpContract in dataContract preservando tutte le informazioni
 */
function convertNlpContractToDataContract(nlpContract) {
  if (!nlpContract || typeof nlpContract !== 'object') {
    return null;
  }

  const contracts = [];

  // CASO 1: Struttura nuova (methods + escalationOrder)
  if (nlpContract.methods && typeof nlpContract.methods === 'object') {
    // Usa escalationOrder se presente, altrimenti ordine naturale
    const order = nlpContract.escalationOrder && Array.isArray(nlpContract.escalationOrder)
      ? nlpContract.escalationOrder
      : ['regex', 'rules', 'ner', 'llm', 'embeddings'];

    for (const methodType of order) {
      const method = nlpContract.methods[methodType];
      if (method && typeof method === 'object') {
        // Includi solo se enabled !== false (default: true)
        const enabled = method.enabled !== false;
        if (enabled) {
          // Crea contract preservando tutti i campi specifici del metodo
          const contract = {
            type: methodType,
            enabled: enabled,
            ...method // Copia tutti i campi (patterns, extractorCode, systemPrompt, ecc.)
          };
          // Rimuovi enabled duplicato se era già presente
          if (method.enabled !== undefined) {
            contract.enabled = method.enabled;
          }
          contracts.push(contract);
        }
      }
    }
  }
  // CASO 2: Struttura legacy (regex/rules/llm/ner a root level)
  else {
    const order = ['regex', 'rules', 'ner', 'llm', 'embeddings'];

    for (const methodType of order) {
      const method = nlpContract[methodType];
      if (method && typeof method === 'object') {
        // Per legacy, enabled è true di default (o dal campo enabled se presente)
        const enabled = method.enabled !== false;
        const contract = {
          type: methodType,
          enabled: enabled,
          ...method // Copia tutti i campi
        };
        // Rimuovi enabled duplicato se era già presente
        if (method.enabled !== undefined) {
          contract.enabled = method.enabled;
        }
        contracts.push(contract);
      }
    }
  }

  // Se non ci sono contract, ritorna null
  if (contracts.length === 0) {
    return null;
  }

  // Costruisci dataContract preservando tutti i metadati
  const dataContract = {
    templateName: nlpContract.templateName || nlpContract.name || 'unknown',
    templateId: nlpContract.templateId || nlpContract.id || null,
    subDataMapping: nlpContract.subDataMapping || {}
  };

  // Aggiungi sourceTemplateId se presente
  if (nlpContract.sourceTemplateId) {
    dataContract.sourceTemplateId = nlpContract.sourceTemplateId;
  }

  // Aggiungi contracts
  dataContract.contracts = contracts;

  return dataContract;
}

/**
 * Converte patterns legacy in dataContract
 */
function convertPatternsToDataContract(patterns, templateId, templateName) {
  if (!patterns || typeof patterns !== 'object') {
    return null;
  }

  const contracts = [];
  const locales = Object.keys(patterns);

  if (locales.length > 0) {
    const firstLocale = locales[0];
    const patternArray = Array.isArray(patterns[firstLocale])
      ? patterns[firstLocale]
      : [patterns[firstLocale]];

    contracts.push({
      type: 'regex',
      enabled: true,
      patterns: patternArray
    });
  }

  if (contracts.length === 0) {
    return null;
  }

  return {
    templateName: templateName || 'unknown',
    templateId: templateId,
    sourceTemplateId: templateId,
    subDataMapping: {},
    contracts: contracts
  };
}

async function migrate() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);

    // ========================================================================
    // 1. MIGRAZIONE: Tasks collection (FACTORY TEMPLATES)
    // ========================================================================
    console.log('📋 1. MIGRAZIONE: Tasks collection (factory templates)');
    console.log('-'.repeat(80));

    // ✅ CERCA template factory che hanno nlpContract O patterns O nessuno dei due
    const factoryTemplates = await db.collection('Tasks').find({
      $or: [
        { nlpContract: { $exists: true, $ne: null } },
        { patterns: { $exists: true, $ne: null } },
        // Template senza dataContract (per creare base)
        {
          $and: [
            { nlpContract: { $exists: false } },
            { patterns: { $exists: false } },
            { dataContract: { $exists: false } }
          ]
        }
      ]
    }).toArray();

    console.log(`   Trovati ${factoryTemplates.length} template factory da processare\n`);

    let factoryTemplatesMigrated = 0;
    let factoryTemplatesSkipped = 0;
    let factoryTemplatesCreated = 0;

    for (const template of factoryTemplates) {
      const templateId = template.id || template._id;
      const templateName = template.label || template.name || 'unknown';

      // Se ha già dataContract, skip
      if (template.dataContract) {
        factoryTemplatesSkipped++;
        continue;
      }

      // ✅ PRIORITY 1: Migra da nlpContract
      if (template.nlpContract) {
        const dataContract = convertNlpContractToDataContract(template.nlpContract);

        if (dataContract) {
          await db.collection('Tasks').updateOne(
            { _id: template._id },
            {
              $set: { dataContract: dataContract, updatedAt: new Date() },
              $unset: { nlpContract: '' }
            }
          );
          console.log(`   ✅ Template ${templateId}: migrato da nlpContract (${dataContract.contracts.length} contracts)`);
          factoryTemplatesMigrated++;
          continue;
        }
      }

      // ✅ PRIORITY 2: Migra da patterns
      if (template.patterns) {
        const dataContract = convertPatternsToDataContract(template.patterns, templateId, templateName);

        if (dataContract) {
          await db.collection('Tasks').updateOne(
            { _id: template._id },
            {
              $set: { dataContract: dataContract, updatedAt: new Date() }
            }
          );
          console.log(`   ✅ Template ${templateId}: migrato da patterns (${dataContract.contracts.length} contracts)`);
          factoryTemplatesMigrated++;
          continue;
        }
      }

      // ✅ PRIORITY 3: Crea dataContract base
      const baseDataContract = {
        templateName: templateName,
        templateId: templateId,
        sourceTemplateId: templateId,
        subDataMapping: {},
        contracts: [
          {
            type: 'regex',
            enabled: true,
            patterns: []
          }
        ]
      };

      await db.collection('Tasks').updateOne(
        { _id: template._id },
        {
          $set: { dataContract: baseDataContract, updatedAt: new Date() }
        }
      );
      console.log(`   ✅ Template ${templateId}: creato dataContract base`);
      factoryTemplatesCreated++;
    }

    console.log(`\n   ✅ Template factory migrati: ${factoryTemplatesMigrated}`);
    console.log(`   ✅ Template factory creati (base): ${factoryTemplatesCreated}`);
    console.log(`   ⚠️  Template factory saltati: ${factoryTemplatesSkipped}\n`);

    // ========================================================================
    // 2. MIGRAZIONE: Tasks collection (PROJECT INSTANCES)
    // ========================================================================
    console.log('📋 2. MIGRAZIONE: Tasks collection (project instances)');
    console.log('-'.repeat(80));

    const projectTasks = await db.collection('Tasks').find({
      $or: [
        { nlpContract: { $exists: true, $ne: null } },
        { 'mainData.0.nlpContract': { $exists: true, $ne: null } }
      ]
    }).toArray();

    console.log(`   Trovati ${projectTasks.length} task con nlpContract\n`);

    let projectTasksMigrated = 0;
    let projectTasksSkipped = 0;

    for (const task of projectTasks) {
      // Skip se è già un template factory (già processato sopra)
      if (task.dataContract) {
        projectTasksSkipped++;
        continue;
      }

      const nlpContract = task.nlpContract || task.mainData?.[0]?.nlpContract;

      if (!nlpContract) {
        projectTasksSkipped++;
        continue;
      }

      const dataContract = convertNlpContractToDataContract(nlpContract);

      if (!dataContract) {
        console.log(`   ⚠️  Task ${task.id || task._id}: nlpContract vuoto o invalido, skip`);
        projectTasksSkipped++;
        continue;
      }

      const update = {
        $set: { dataContract: dataContract, updatedAt: new Date() },
        $unset: {}
      };

      if (task.nlpContract) {
        update.$unset.nlpContract = '';
      }

      if (task.mainData && task.mainData[0] && task.mainData[0].nlpContract) {
        update.$unset['mainData.0.nlpContract'] = '';
      }

      await db.collection('Tasks').updateOne(
        { _id: task._id },
        update
      );

      console.log(`   ✅ Task ${task.id || task._id}: migrato (${dataContract.contracts.length} contracts)`);
      projectTasksMigrated++;
    }

    console.log(`\n   ✅ Task migrati: ${projectTasksMigrated}`);
    console.log(`   ⚠️  Task saltati: ${projectTasksSkipped}\n`);

    // ========================================================================
    // 3. VERIFICA FINALE
    // ========================================================================
    console.log('📋 3. VERIFICA: Controllo template senza dataContract');
    console.log('-'.repeat(80));

    const templatesWithoutDataContract = await db.collection('Tasks').countDocuments({
      $and: [
        { dataContract: { $exists: false } },
        { nlpContract: { $exists: false } },
        { patterns: { $exists: false } }
      ]
    });

    const remainingNlpContracts = await db.collection('Tasks').countDocuments({
      $or: [
        { nlpContract: { $exists: true, $ne: null } },
        { 'mainData.0.nlpContract': { $exists: true, $ne: null } }
      ]
    });

    if (templatesWithoutDataContract === 0 && remainingNlpContracts === 0) {
      console.log('   ✅ Tutti i template hanno dataContract');
      console.log('   ✅ Nessun nlpContract residuo trovato\n');
    } else {
      console.log(`   ⚠️  Trovati ${templatesWithoutDataContract} template senza dataContract`);
      console.log(`   ⚠️  Trovati ${remainingNlpContracts} documenti con nlpContract residuo\n`);
    }

    // ========================================================================
    // 4. RIEPILOGO FINALE
    // ========================================================================
    console.log('📋 RIEPILOGO FINALE');
    console.log('='.repeat(80));
    console.log(`   ✅ Template factory migrati: ${factoryTemplatesMigrated}`);
    console.log(`   ✅ Template factory creati: ${factoryTemplatesCreated}`);
    console.log(`   ✅ Task migrati: ${projectTasksMigrated}`);
    console.log(`   ⚠️  Template factory saltati: ${factoryTemplatesSkipped}`);
    console.log(`   ⚠️  Task saltati: ${projectTasksSkipped}`);
    console.log(`   ✅ Migrazione completata!\n`);

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    console.error(error.stack);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Esegui migrazione
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('\n✅ Migrazione completata con successo!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migrazione fallita:', error);
      process.exit(1);
    });
}

module.exports = { migrate, convertNlpContractToDataContract, convertPatternsToDataContract };
