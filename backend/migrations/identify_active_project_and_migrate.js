/**
 * Script: Identifica progetto attivo, migra task, e verifica database orfani
 *
 * Esegui con: node backend/migrations/identify_active_project_and_migrate.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

// ✅ TaskType enum
const TaskType = {
  UNDEFINED: -1,
  SayMessage: 0,
  CloseSession: 1,
  Transfer: 2,
  DataRequest: 3,
  BackendCall: 4,
  ClassifyProblem: 5
};

// ✅ Mapping: templateId semantico → TaskType enum
const TEMPLATE_ID_TO_TYPE = {
  'saymessage': TaskType.SayMessage,
  'message': TaskType.SayMessage,
  'datarequest': TaskType.DataRequest,
  'getdata': TaskType.DataRequest,
  'undefined': TaskType.UNDEFINED
};

function isValidGuid(str) {
  if (!str || typeof str !== 'string') return false;
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidRegex.test(str);
}

function determineTaskType(task) {
  // 1. Se type è già un numero valido, usalo
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

  // 3. Se ha mainData, è DataRequest
  if (task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) {
    return TaskType.DataRequest;
  }

  // 4. Se ha text, è SayMessage
  if (task.text && typeof task.text === 'string' && task.text.trim().length > 0) {
    return TaskType.SayMessage;
  }

  // 5. Default: SayMessage
  return TaskType.SayMessage;
}

function normalizeTemplateId(templateId) {
  if (!templateId) return null;
  if (isValidGuid(templateId)) return templateId;
  return null; // Stringhe semantiche → null
}

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    // ===================================
    // 1. IDENTIFICA PROGETTI "NUOVO"
    // ===================================
    console.log('🔍 Step 1: Identificazione progetti "nuovo"...\n');

    const catalogDb = client.db(dbProjects);
    const catalog = catalogDb.collection('projects_catalog');

    // Cerca progetti con nome "nuovo" (case-insensitive)
    const nuovoProjects = await catalog.find({
      $or: [
        { projectName: /^nuovo$/i },
        { projectSlug: /^nuovo/i }
      ]
    }).toArray();

    console.log(`📋 Trovati ${nuovoProjects.length} progetti "nuovo" nel catalogo:`);
    nuovoProjects.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.projectName} (${p.projectId})`);
      console.log(`      DB: ${p.dbName || 'N/A'}`);
      console.log(`      Status: ${p.status || 'N/A'}`);
      console.log(`      Created: ${p.createdAt || 'N/A'}\n`);
    });

    // Identifica progetto attivo (status='active' o più recente)
    const activeProject = nuovoProjects.find(p => p.status === 'active') ||
                         nuovoProjects.sort((a, b) =>
                           new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                         )[0];

    if (!activeProject) {
      console.log('❌ Nessun progetto "nuovo" trovato nel catalogo');
      console.log('   Verifica se il progetto esiste o usa un nome diverso\n');
      return;
    }

    console.log(`\n✅ Progetto attivo identificato: ${activeProject.projectName}`);
    console.log(`   ProjectId: ${activeProject.projectId}`);
    console.log(`   Database: ${activeProject.dbName || 'N/A'}\n`);

    // ===================================
    // 2. VERIFICA DATABASE ORFANI
    // ===================================
    console.log('🔍 Step 2: Verifica database orfani...\n');

    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();

    // Database progetto che iniziano con t_no-client__p_nuovo__
    const nuovoDatabases = dbList.databases
      .filter(db => db.name.startsWith('t_no-client__p_nuovo'))
      .map(db => db.name);

    console.log(`📋 Trovati ${nuovoDatabases.length} database "nuovo":`);
    nuovoDatabases.forEach(db => {
      const inCatalog = nuovoProjects.some(p => p.dbName === db);
      console.log(`   ${inCatalog ? '✅' : '❌ ORFANO'} ${db}`);
      if (!inCatalog) {
        console.log(`      ⚠️  Database presente ma NON nel catalogo!`);
      }
    });

    const orphanDatabases = nuovoDatabases.filter(db =>
      !nuovoProjects.some(p => p.dbName === db)
    );

    if (orphanDatabases.length > 0) {
      console.log(`\n⚠️  Trovati ${orphanDatabases.length} database orfani:`);
      orphanDatabases.forEach(db => console.log(`   - ${db}`));
      console.log('\n💡 Questi database non sono nel catalogo ma esistono ancora.');
      console.log('   Potrebbero essere rimasti dopo eliminazione progetti.\n');
    }

    // ===================================
    // 3. MIGRA TASK NEL PROGETTO ATTIVO
    // ===================================
    if (!activeProject.dbName) {
      console.log('❌ Progetto attivo non ha dbName - impossibile migrare task');
      return;
    }

    console.log(`🔧 Step 3: Migrazione task in ${activeProject.dbName}...\n`);

    const projDb = client.db(activeProject.dbName);
    const tasksColl = projDb.collection('tasks');

    const allTasks = await tasksColl.find({}).toArray();
    console.log(`📋 Trovati ${allTasks.length} task nel database\n`);

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
        console.log(`   [${task.id}] Aggiunto type: ${determinedType}`);
      }

      // 2. Verifica/fissa templateId
      const normalizedTemplateId = normalizeTemplateId(task.templateId);
      if (task.templateId !== normalizedTemplateId) {
        updates.templateId = normalizedTemplateId;
        templateIdFixed++;
        needsUpdate = true;
        console.log(`   [${task.id}] Fix templateId: "${task.templateId}" → ${normalizedTemplateId === null ? 'null' : normalizedTemplateId}`);
      }

      // 3. Applica aggiornamenti
      if (needsUpdate) {
        await tasksColl.updateOne(
          { id: task.id },
          { $set: updates }
        );
        updated++;
      }
    }

    console.log(`\n✅ Migrazione completata:`);
    console.log(`   - Tasks aggiornati: ${updated}`);
    console.log(`   - Type aggiunti: ${typeAdded}`);
    console.log(`   - TemplateId corretti: ${templateIdFixed}\n`);

    // ===================================
    // 4. RIEPILOGO
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Progetto attivo: ${activeProject.projectName} (${activeProject.projectId})`);
    console.log(`Database: ${activeProject.dbName}`);
    console.log(`Task nel database: ${allTasks.length}`);
    console.log(`Task migrati: ${updated}`);
    console.log(`Database orfani trovati: ${orphanDatabases.length}`);
    if (orphanDatabases.length > 0) {
      console.log(`\n⚠️  Database orfani da eliminare manualmente:`);
      orphanDatabases.forEach(db => console.log(`   - ${db}`));
    }
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

