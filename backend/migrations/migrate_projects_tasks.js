/**
 * Migrazione: Migra Task_Templates nei progetti → Tasks
 *
 * Migra Task_Templates → Tasks per tutti i progetti nel database.
 * Esegui dopo migrate_tasks_unified_model.js per la factory.
 *
 * Esegui con: node backend/migrations/migrate_projects_tasks.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// ✅ TaskType enum (stesso di migrate_tasks_unified_model.js)
const TaskType = {
  UNDEFINED: -1,
  SayMessage: 0,
  CloseSession: 1,
  Transfer: 2,
  DataRequest: 3,
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

const ACTION_ID_TO_ENUM = {
  'sendsms': TaskType.SendSMS,
  'sendemail': TaskType.SendEmail,
  'escalatetohuman': TaskType.EscalateToHuman,
  'escalatetoguardvr': TaskType.EscalateToGuardVR,
  'tohuman': TaskType.EscalateToHuman,
  'toguardvr': TaskType.EscalateToGuardVR,
  'readfrombackend': TaskType.ReadFromBackend,
  'writetobackend': TaskType.WriteToBackend,
  'readbackend': TaskType.ReadFromBackend,
  'writebackend': TaskType.WriteToBackend,
  'logdata': TaskType.LogData,
  'loglabel': TaskType.LogLabel,
  'registerdata': TaskType.LogData,
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
  'data': TaskType.DataRequest,
  'request': TaskType.DataRequest,
  'backend': TaskType.BackendCall,
  'problem': TaskType.ClassifyProblem,
  'classify': TaskType.ClassifyProblem,
  'action': TaskType.SayMessage,
  'say': TaskType.SayMessage,
  'close': TaskType.CloseSession,
  'end': TaskType.CloseSession
};

function determineTaskType(template) {
  if (typeof template.type === 'number' && template.type >= -1 && template.type <= 19) {
    return template.type;
  }

  if (typeof template.type === 'string') {
    const normalized = template.type.toLowerCase().trim();
    const enumValue = TYPE_STRING_TO_ENUM[normalized];
    if (enumValue !== undefined) {
      return enumValue;
    }
  }

  if (template.taskType === 'Action' || template.taskType === 'action') {
    const id = (template.id || template.name || '').toLowerCase().trim();
    const enumValue = ACTION_ID_TO_ENUM[id];
    if (enumValue !== undefined) {
      return enumValue;
    }
  }

  const id = (template.id || template.name || '').toLowerCase().trim();
  const enumValue = ACTION_ID_TO_ENUM[id];
  if (enumValue !== undefined) {
    return enumValue;
  }

  if ((template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) ||
      (template.subDataIds && Array.isArray(template.subDataIds) && template.subDataIds.length > 0)) {
    return TaskType.DataRequest;
  }

  return TaskType.SayMessage;
}

function normalizeToTask(template) {
  const task = {
    _id: template._id || template.id,
    id: template.id || template._id || template.name,
    type: determineTaskType(template),
    templateId: null,
    label: template.label || template.name || template.id || 'Unnamed Task',
  };

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

  return task;
}

async function getProjectDatabases(client) {
  const adminDb = client.db().admin();
  const databases = await adminDb.listDatabases();

  // Filtra solo i database dei progetti (escludi factory, admin, local, config)
  const projectDbs = databases.databases
    .filter(db => {
      const name = db.name.toLowerCase();
      return name !== 'factory' &&
             name !== 'admin' &&
             name !== 'local' &&
             name !== 'config' &&
             !name.startsWith('system');
    })
    .map(db => db.name);

  return projectDbs;
}

async function migrateProjectTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // 1. Trova tutti i database dei progetti
    const projectDbs = await getProjectDatabases(client);
    console.log(`📋 Trovati ${projectDbs.length} database progetti\n`);

    if (projectDbs.length === 0) {
      console.log('⚠️  Nessun progetto da migrare');
      return;
    }

    let totalMigrated = 0;
    let totalProjects = 0;

    // 2. Migra ogni progetto
    for (const projectDbName of projectDbs) {
      try {
        console.log(`\n🔄 Migrazione progetto: ${projectDbName}`);
        const projDb = client.db(projectDbName);
        const sourceColl = projDb.collection('Task_Templates');
        const targetColl = projDb.collection('Tasks');

        // Conta template
        const templateCount = await sourceColl.countDocuments({});
        if (templateCount === 0) {
          console.log(`   ⏭️  Nessun template da migrare`);
          continue;
        }

        console.log(`   📋 Trovati ${templateCount} template`);

        // Leggi template
        const templates = await sourceColl.find({}).toArray();
        const tasks = templates.map(normalizeToTask);

        // Crea collection Tasks se non esiste
        const collections = await projDb.listCollections({ name: 'Tasks' }).toArray();
        if (collections.length === 0) {
          await projDb.createCollection('Tasks');
        }

        // Migra
        let inserted = 0;
        let updated = 0;
        for (const task of tasks) {
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

          if (result.upsertedCount > 0) inserted++;
          else if (result.modifiedCount > 0) updated++;
        }

        // Cleanup taskType
        await targetColl.updateMany(
          { taskType: { $exists: true } },
          { $unset: { taskType: '' } }
        );

        console.log(`   ✅ Migrati: ${inserted} inseriti, ${updated} aggiornati`);
        totalMigrated += tasks.length;
        totalProjects++;

      } catch (error) {
        console.error(`   ❌ Errore su progetto ${projectDbName}:`, error.message);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RIEPILOGO MIGRAZIONE PROGETTI');
    console.log('='.repeat(80));
    console.log(`   Progetti processati: ${totalProjects}`);
    console.log(`   Task migrati totali: ${totalMigrated}`);
    console.log('='.repeat(80));
    console.log('\n🎉 MIGRAZIONE PROGETTI COMPLETATA');

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
  migrateProjectTasks()
    .then(() => {
      console.log('\n✅ Script completato');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { migrateProjectTasks };

