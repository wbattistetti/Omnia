/**
 * Migration: Fix all Tasks in database to have correct type and templateId
 *
 * Questo script:
 * 1. Aggiunge type: TaskType enum a tutti i Task che non ce l'hanno
 * 2. Converte templateId da stringhe semantiche ("SayMessage", "DataRequest") a null (standalone)
 * 3. Mantiene templateId GUID se è un GUID valido (referenza a altro Task)
 * 4. Assicura che tutti i Task abbiano la struttura corretta
 *
 * Esegui con: node backend/migrations/fix_tasks_type_and_templateid.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// ✅ TaskType enum (allineato con frontend)
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

// ✅ Mapping: templateId semantico → TaskType enum
const TEMPLATE_ID_TO_TYPE = {
  'saymessage': TaskType.SayMessage,
  'message': TaskType.SayMessage,
  'closesession': TaskType.CloseSession,
  'transfer': TaskType.Transfer,
  'datarequest': TaskType.DataRequest,
  'getdata': TaskType.DataRequest,
  'backendcall': TaskType.BackendCall,
  'callbackend': TaskType.BackendCall,
  'classifyproblem': TaskType.ClassifyProblem,
  'problemclassification': TaskType.ClassifyProblem,
  'undefined': TaskType.UNDEFINED
};

// ✅ Mapping: action ID → TaskType enum (per action specifiche)
const ACTION_ID_TO_TYPE = {
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

/**
 * Verifica se una stringa è un GUID valido
 */
function isValidGuid(str) {
  if (!str || typeof str !== 'string') return false;
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidRegex.test(str);
}

/**
 * Determina TaskType da un Task esistente
 */
function determineTaskType(task) {
  // 1. Se type è già un numero valido (0-19 o -1), usalo
  if (typeof task.type === 'number' && task.type >= -1 && task.type <= 19) {
    return task.type;
  }

  // 2. Se templateId è una stringa semantica, convertila
  if (task.templateId && typeof task.templateId === 'string' && !isValidGuid(task.templateId)) {
    const normalized = task.templateId.toLowerCase().trim();
    const type = TEMPLATE_ID_TO_TYPE[normalized];
    if (type !== undefined) {
      return type;
    }
  }

  // 3. Se id/name è un action ID, convertilo
  const id = (task.id || task.name || '').toLowerCase().trim();
  const actionType = ACTION_ID_TO_TYPE[id];
  if (actionType !== undefined) {
    return actionType;
  }

  // 4. Se ha mainData/subDataIds, è probabilmente DataRequest
  if ((task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) ||
      (task.subDataIds && Array.isArray(task.subDataIds) && task.subDataIds.length > 0)) {
    return TaskType.DataRequest;
  }

  // 5. Se ha intents, è ClassifyProblem
  if (task.intents && Array.isArray(task.intents) && task.intents.length > 0) {
    return TaskType.ClassifyProblem;
  }

  // 6. Se ha endpoint/method, è BackendCall
  if (task.endpoint || task.method) {
    return TaskType.BackendCall;
  }

  // 7. Se ha text, è SayMessage
  if (task.text && typeof task.text === 'string' && task.text.trim().length > 0) {
    return TaskType.SayMessage;
  }

  // 8. Default: SayMessage (non UNDEFINED, perché UNDEFINED non è valido per il runtime)
  // I task con templateId="UNDEFINED" e nessun altro campo sono probabilmente SayMessage incompleti
  return TaskType.SayMessage;
}

/**
 * Normalizza templateId: converte stringhe semantiche a null, mantiene GUID
 */
function normalizeTemplateId(templateId, taskType) {
  // Se è null o undefined, è già corretto (standalone)
  if (!templateId) {
    return null;
  }

  // Se è un GUID valido, mantienilo (referenza a altro Task)
  if (isValidGuid(templateId)) {
    return templateId;
  }

  // Se è una stringa semantica, convertila a null (standalone)
  // Le stringhe semantiche come "SayMessage", "DataRequest" non sono più valide come templateId
  return null;
}

/**
 * Migra Tasks nella factory
 */
async function migrateFactoryTasks(client) {
  console.log('\n📦 Migrating Factory Tasks...');
  const db = client.db(dbFactory);

  // Cerca in tutte le possibili collection (backward compatibility)
  const collections = ['Tasks', 'tasks', 'Task_Templates'];
  let allTasks = [];

  for (const collName of collections) {
    try {
      const collection = db.collection(collName);
      const tasks = await collection.find({}).toArray();
      if (tasks.length > 0) {
        console.log(`Found ${tasks.length} tasks in collection "${collName}"`);
        allTasks = allTasks.concat(tasks.map(t => ({ ...t, _collection: collName })));
      }
    } catch (err) {
      // Collection non esiste, skip
    }
  }

  console.log(`Total tasks found: ${allTasks.length}`);

  let updated = 0;
  let typeAdded = 0;
  let templateIdFixed = 0;

  for (const task of allTasks) {
    const updates = {};
    let needsUpdate = false;

    // 1. Verifica/aggiungi type
    if (typeof task.type !== 'number' || task.type < -1 || task.type > 19) {
      const determinedType = determineTaskType(task);
      updates.type = determinedType;
      typeAdded++;
      needsUpdate = true;
      console.log(`  [${task.id}] Adding type: ${determinedType} (${getTypeName(determinedType)})`);
    }

    // 2. Verifica/fissa templateId
    const normalizedTemplateId = normalizeTemplateId(task.templateId, task.type || updates.type);
    if (task.templateId !== normalizedTemplateId) {
      updates.templateId = normalizedTemplateId;
      templateIdFixed++;
      needsUpdate = true;
      console.log(`  [${task.id}] Fixing templateId: "${task.templateId}" → ${normalizedTemplateId === null ? 'null' : normalizedTemplateId}`);
    }

    // 3. Applica aggiornamenti
    if (needsUpdate) {
      const collName = task._collection || 'Tasks';
      const collection = db.collection(collName);
      await collection.updateOne(
        { id: task.id },
        { $set: updates }
      );
      updated++;
    }
  }

  console.log(`\n✅ Factory migration complete:`);
  console.log(`  - Tasks updated: ${updated}`);
  console.log(`  - Type added: ${typeAdded}`);
  console.log(`  - TemplateId fixed: ${templateIdFixed}`);
}

/**
 * Migra Tasks nei progetti
 */
async function migrateProjectTasks(client) {
  console.log('\n📦 Migrating Project Tasks...');

  const adminDb = client.db().admin();
  const databases = await adminDb.listDatabases();

  const projectDbs = databases.databases.filter(db =>
    db.name.startsWith('proj_') && db.name !== dbFactory
  );

  console.log(`Found ${projectDbs.length} project databases`);

  let totalUpdated = 0;
  let totalTypeAdded = 0;
  let totalTemplateIdFixed = 0;

  for (const dbInfo of projectDbs) {
    const dbName = dbInfo.name;
    const db = client.db(dbName);
    const collection = db.collection('tasks');

    try {
      // Cerca in tutte le possibili collection
      const collections = ['tasks', 'Tasks', 'Task_Templates'];
      let allTasks = [];

      for (const collName of collections) {
        try {
          const coll = db.collection(collName);
          const tasks = await coll.find({}).toArray();
          if (tasks.length > 0) {
            allTasks = allTasks.concat(tasks.map(t => ({ ...t, _collection: collName })));
          }
        } catch (err) {
          // Collection non esiste, skip
        }
      }

      console.log(`\n  Processing ${dbName}: ${allTasks.length} tasks`);

      let updated = 0;
      let typeAdded = 0;
      let templateIdFixed = 0;

      for (const task of allTasks) {
        const updates = {};
        let needsUpdate = false;

        // 1. Verifica/aggiungi type
        if (typeof task.type !== 'number' || task.type < -1 || task.type > 19) {
          const determinedType = determineTaskType(task);
          updates.type = determinedType;
          typeAdded++;
          needsUpdate = true;
        }

        // 2. Verifica/fissa templateId
        const normalizedTemplateId = normalizeTemplateId(task.templateId, task.type || updates.type);
        if (task.templateId !== normalizedTemplateId) {
          updates.templateId = normalizedTemplateId;
          templateIdFixed++;
          needsUpdate = true;
        }

        // 3. Applica aggiornamenti
        if (needsUpdate) {
          const collName = task._collection || 'tasks';
          const coll = db.collection(collName);
          await coll.updateOne(
            { id: task.id },
            { $set: updates }
          );
          updated++;
        }
      }

      if (updated > 0) {
        console.log(`    ✅ Updated ${updated} tasks (type: ${typeAdded}, templateId: ${templateIdFixed})`);
        totalUpdated += updated;
        totalTypeAdded += typeAdded;
        totalTemplateIdFixed += templateIdFixed;
      } else {
        console.log(`    ✅ No updates needed`);
      }
    } catch (err) {
      console.error(`    ❌ Error processing ${dbName}:`, err.message);
    }
  }

  console.log(`\n✅ Project migration complete:`);
  console.log(`  - Total tasks updated: ${totalUpdated}`);
  console.log(`  - Total type added: ${totalTypeAdded}`);
  console.log(`  - Total templateId fixed: ${totalTemplateIdFixed}`);
}

/**
 * Helper: nome del tipo per logging
 */
function getTypeName(type) {
  const names = {
    [-1]: 'UNDEFINED',
    [0]: 'SayMessage',
    [1]: 'CloseSession',
    [2]: 'Transfer',
    [3]: 'DataRequest',
    [4]: 'BackendCall',
    [5]: 'ClassifyProblem',
    [6]: 'SendSMS',
    [7]: 'SendEmail',
    [8]: 'EscalateToHuman',
    [9]: 'EscalateToGuardVR',
    [10]: 'ReadFromBackend',
    [11]: 'WriteToBackend',
    [12]: 'LogData',
    [13]: 'LogLabel',
    [14]: 'PlayJingle',
    [15]: 'Jump',
    [16]: 'HangUp',
    [17]: 'Assign',
    [18]: 'Clear',
    [19]: 'WaitForAgent'
  };
  return names[type] || 'UNKNOWN';
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Starting Task Type and TemplateId Migration...\n');

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    // Migra factory
    await migrateFactoryTasks(client);

    // Migra progetti
    await migrateProjectTasks(client);

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

// Esegui
main().catch(console.error);

