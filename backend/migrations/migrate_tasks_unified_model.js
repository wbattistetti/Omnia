/**
 * Migrazione: Unificare Task_Templates → Tasks con modello unificato
 *
 * Questa migrazione:
 * 1. Migra Task_Templates → Tasks (nuova collection)
 * 2. Aggiunge templateId: null a tutti i documenti (standalone)
 * 3. Rimuove taskType legacy (usa solo type enum numerico)
 * 4. Mappa action IDs ai nuovi enum (6-19)
 * 5. Assicura che tutti abbiano id, type, label, templateId
 *
 * Esegui con: node backend/migrations/migrate_tasks_unified_model.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// ✅ TaskType enum esteso (allineato con frontend)
const TaskType = {
  UNDEFINED: -1,
  SayMessage: 0,
  CloseSession: 1,
  Transfer: 2,
  DataRequest: 3,      // Rinominato da GetData
  BackendCall: 4,
  ClassifyProblem: 5,
  SendSMS: 6,
  SendEmail: 7,
  EscalateToHuman: 8,
  EscalateToGuardVR: 9,
  ReadFromBackend: 10,
  WriteToBackend: 11,
  LogData: 12,
  LogLabel: 13,
  PlayJingle: 14,
  Jump: 15,
  HangUp: 16,
  Assign: 17,
  Clear: 18,
  WaitForAgent: 19
};

// ✅ Mapping: action ID → enum numerico (CASE-INSENSITIVE)
const ACTION_ID_TO_ENUM = {
  // Communication
  'sendsms': TaskType.SendSMS,
  'sendemail': TaskType.SendEmail,
  // Escalation
  'escalatetohuman': TaskType.EscalateToHuman,
  'escalatetoguardvr': TaskType.EscalateToGuardVR,
  'tohuman': TaskType.EscalateToHuman,
  'toguardvr': TaskType.EscalateToGuardVR,
  // Backend
  'readfrombackend': TaskType.ReadFromBackend,
  'writetobackend': TaskType.WriteToBackend,
  'readbackend': TaskType.ReadFromBackend,
  'writebackend': TaskType.WriteToBackend,
  // Logging
  'logdata': TaskType.LogData,
  'loglabel': TaskType.LogLabel,
  'registerdata': TaskType.LogData,
  // Media/Flow
  'playjingle': TaskType.PlayJingle,
  'jingle': TaskType.PlayJingle,
  'jump': TaskType.Jump,
  'skip': TaskType.Jump,
  'hangup': TaskType.HangUp,
  'close': TaskType.HangUp,
  'assign': TaskType.Assign,
  'clear': TaskType.Clear,
  'waitforagent': TaskType.WaitForAgent,
  'waitagent': TaskType.WaitForAgent
};

// ✅ Mapping: type string → enum numerico (per compatibilità)
const TYPE_STRING_TO_ENUM = {
  'message': TaskType.SayMessage,
  'saymessage': TaskType.SayMessage,
  'closesession': TaskType.CloseSession,
  'transfer': TaskType.Transfer,
  'datarequest': TaskType.DataRequest,
  'getdata': TaskType.DataRequest,
  'backendcall': TaskType.BackendCall,
  'callbackend': TaskType.BackendCall,
  'problemclassification': TaskType.ClassifyProblem,
  'classifyproblem': TaskType.ClassifyProblem,
  // Varianti
  'data': TaskType.DataRequest,
  'request': TaskType.DataRequest,
  'backend': TaskType.BackendCall,
  'problem': TaskType.ClassifyProblem,
  'classify': TaskType.ClassifyProblem,
  'action': TaskType.SayMessage,  // Generic action → SayMessage (legacy)
  'say': TaskType.SayMessage,
  'close': TaskType.CloseSession,
  'end': TaskType.CloseSession
};

/**
 * Determina il TaskType enum da un template
 */
function determineTaskType(template) {
  // 1. Se type è già un numero valido (0-19), usalo
  if (typeof template.type === 'number' && template.type >= -1 && template.type <= 19) {
    return template.type;
  }

  // 2. Se type è una stringa, convertila
  if (typeof template.type === 'string') {
    const normalized = template.type.toLowerCase().trim();
    const enumValue = TYPE_STRING_TO_ENUM[normalized];
    if (enumValue !== undefined) {
      return enumValue;
    }
  }

  // 3. Se taskType è 'Action', cerca l'action ID
  if (template.taskType === 'Action' || template.taskType === 'action') {
    // Cerca per id o name
    const id = (template.id || template.name || '').toLowerCase().trim();
    const enumValue = ACTION_ID_TO_ENUM[id];
    if (enumValue !== undefined) {
      return enumValue;
    }
  }

  // 4. Cerca per id/name direttamente nelle action
  const id = (template.id || template.name || '').toLowerCase().trim();
  const enumValue = ACTION_ID_TO_ENUM[id];
  if (enumValue !== undefined) {
    return enumValue;
  }

  // 5. Se ha mainData/subDataIds, è probabilmente DataRequest
  if ((template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) ||
      (template.subDataIds && Array.isArray(template.subDataIds) && template.subDataIds.length > 0)) {
    return TaskType.DataRequest;
  }

  // 6. Default: SayMessage
  return TaskType.SayMessage;
}

/**
 * Normalizza un template in Task unificato
 */
function normalizeToTask(template) {
  const task = {
    _id: template._id || template.id,
    id: template.id || template._id || template.name,
    type: determineTaskType(template),
    templateId: null,  // ✅ Tutti i template sono standalone (templateId: null)
    label: template.label || template.name || template.id || 'Unnamed Task',
  };

  // Copia campi opzionali
  if (template.description !== undefined) task.description = template.description;
  if (template.icon !== undefined) task.icon = template.icon;
  if (template.color !== undefined) task.color = template.color;
  if (template.valueSchema !== undefined) task.valueSchema = template.valueSchema;
  if (template.signature !== undefined) task.signature = template.signature;
  if (template.scope !== undefined) task.scope = template.scope;
  if (template.industry !== undefined) task.industry = template.industry;
  if (template.mainData !== undefined) task.mainData = template.mainData;
  if (template.subDataIds !== undefined) task.subDataIds = template.subDataIds;
  if (template.constraints !== undefined) task.constraints = template.constraints;
  if (template.examples !== undefined) task.examples = template.examples;
  if (template.createdAt !== undefined) task.createdAt = template.createdAt;
  if (template.updatedAt !== undefined) task.updatedAt = template.updatedAt;

  // ✅ Rimuovi campi legacy
  // taskType verrà rimosso (non copiato)
  // Altri campi legacy possono essere rimossi qui

  return task;
}

async function migrateTasksUnifiedModel() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);
    const sourceColl = db.collection('Task_Templates');
    const targetColl = db.collection('Tasks');

    // 1. Trova tutti i template
    const allTemplates = await sourceColl.find({}).toArray();
    console.log(`📋 Trovati ${allTemplates.length} template in Task_Templates\n`);

    if (allTemplates.length === 0) {
      console.log('⚠️  Nessun template da migrare');
      return;
    }

    // 2. Analizza i template
    console.log('🔍 Analisi template...\n');
    const tasksToMigrate = [];
    const typeStats = {};
    const actionStats = {};

    for (const template of allTemplates) {
      const task = normalizeToTask(template);
      tasksToMigrate.push(task);

      // Statistiche
      const typeKey = `type_${task.type}`;
      typeStats[typeKey] = (typeStats[typeKey] || 0) + 1;

      if (template.taskType === 'Action' || template.taskType === 'action') {
        const actionId = (template.id || template.name || 'unknown').toLowerCase();
        actionStats[actionId] = (actionStats[actionId] || 0) + 1;
      }
    }

    console.log('📊 Statistiche:');
    console.log(`   Template totali: ${allTemplates.length}`);
    console.log(`   Tasks da migrare: ${tasksToMigrate.length}`);
    console.log('\n   Distribuzione per type:');
    Object.entries(typeStats).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
    if (Object.keys(actionStats).length > 0) {
      console.log('\n   Actions trovate:');
      Object.entries(actionStats).sort((a, b) => b[1] - a[1]).forEach(([action, count]) => {
        console.log(`     ${action}: ${count}`);
      });
    }

    // 3. Preview dei primi 10 task
    console.log('\n📝 Preview primi 10 task da migrare:');
    tasksToMigrate.slice(0, 10).forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.id}: "${task.label}" (type: ${task.type}, templateId: ${task.templateId})`);
    });
    if (tasksToMigrate.length > 10) {
      console.log(`   ... e altri ${tasksToMigrate.length - 10} task\n`);
    }

    // 4. Chiedi conferma (in produzione, rimuovi questo e procedi direttamente)
    console.log(`\n⚠️  Procedere con la migrazione di ${tasksToMigrate.length} task?`);
    console.log('   (In questo script procediamo automaticamente)\n');

    // 5. Crea la collection Tasks (se non esiste)
    const collections = await db.listCollections({ name: 'Tasks' }).toArray();
    if (collections.length === 0) {
      console.log('📦 Creazione collection Tasks...');
      await db.createCollection('Tasks');
      console.log('✅ Collection Tasks creata\n');
    }

    // 6. Migra i task
    console.log('🔄 Migrazione in corso...\n');
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const task of tasksToMigrate) {
      try {
        const filter = { _id: task._id };

        // Rimuovi createdAt da $set se presente (va solo in $setOnInsert)
        const taskToSet = { ...task };
        const createdAt = taskToSet.createdAt || new Date();
        delete taskToSet.createdAt;

        const update = {
          $set: taskToSet,
          $setOnInsert: { createdAt: createdAt }
        };

        const result = await targetColl.updateOne(filter, update, { upsert: true });

        if (result.upsertedCount > 0) {
          insertedCount++;
        } else if (result.modifiedCount > 0) {
          updatedCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Errore su task ${task.id}:`, error.message);
      }
    }

    // 7. Rimuovi taskType da tutti i documenti (cleanup)
    console.log('\n🧹 Cleanup: rimozione campo taskType legacy...');
    const cleanupResult = await targetColl.updateMany(
      { taskType: { $exists: true } },
      { $unset: { taskType: '' } }
    );
    console.log(`   ✅ Rimossi taskType da ${cleanupResult.modifiedCount} documenti\n`);

    // 8. Verifica
    console.log('🔍 Verifica migrazione...\n');
    const migratedCount = await targetColl.countDocuments({});
    const withType = await targetColl.countDocuments({ type: { $exists: true, $type: 'number' } });
    const withTemplateId = await targetColl.countDocuments({ templateId: { $exists: true } });
    const withLabel = await targetColl.countDocuments({ label: { $exists: true } });

    console.log('📊 Risultati:');
    console.log(`   Task migrati: ${migratedCount}`);
    console.log(`   Con type numerico: ${withType}`);
    console.log(`   Con templateId: ${withTemplateId}`);
    console.log(`   Con label: ${withLabel}`);

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RIEPILOGO MIGRAZIONE');
    console.log('='.repeat(80));
    console.log(`   Template originali: ${allTemplates.length}`);
    console.log(`   Task inseriti: ${insertedCount}`);
    console.log(`   Task aggiornati: ${updatedCount}`);
    console.log(`   Errori: ${errorCount}`);
    console.log(`   Task totali in Tasks: ${migratedCount}`);
    console.log(`   Campi taskType rimossi: ${cleanupResult.modifiedCount}`);
    console.log('='.repeat(80));
    console.log('\n🎉 MIGRAZIONE COMPLETATA');
    console.log('\n⚠️  NOTA: La collection Task_Templates originale è ancora presente.');
    console.log('   Puoi rimuoverla manualmente dopo aver verificato che tutto funzioni correttamente.');

  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  migrateTasksUnifiedModel()
    .then(() => {
      console.log('\n✅ Script completato');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { migrateTasksUnifiedModel };

