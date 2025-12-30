/**
 * Migration: Completa la migrazione Task_Templates → Tasks
 *
 * Questo script:
 * 1. Copia tutti i campi mancanti da Task_Templates a Tasks
 * 2. Assicura che Tasks abbia tutti i campi necessari
 * 3. Mantiene i dati esistenti in Tasks
 *
 * Esegui con: node backend/migrations/complete_tasks_migration.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const dbProjects = 'Projects';

// Campi da copiare da Task_Templates a Tasks (se mancanti)
const FIELDS_TO_COPY = [
  'dataContracts',
  'patterns',
  'stepPrompts',
  'contexts',
  'name',
  'steps',
  'subDataIds',  // Potrebbe mancare
  'valueSchema', // Potrebbe mancare
  'signature',   // Potrebbe mancare
  'scope',       // Potrebbe mancare
  'industry'     // Potrebbe mancare
];

async function completeFactoryMigration() {
  console.log('\n📦 Completando migrazione Factory...\n');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbFactory);

    const taskTemplates = await db.collection('Task_Templates').find({}).toArray();
    const tasksColl = db.collection('Tasks');

    console.log(`📋 Trovati ${taskTemplates.length} template in Task_Templates\n`);

    let updated = 0;
    let created = 0;

    for (const template of taskTemplates) {
      const taskId = template.id || template._id?.toString();
      if (!taskId) {
        console.log(`   ⚠️  Template senza id, skip: ${template._id}`);
        continue;
      }

      // Trova il task corrispondente
      const existingTask = await tasksColl.findOne({ id: taskId });

      if (existingTask) {
        // Task esiste, aggiungi campi mancanti
        const updates = {};
        let hasUpdates = false;

        for (const field of FIELDS_TO_COPY) {
          if (template[field] !== undefined && existingTask[field] === undefined) {
            updates[field] = template[field];
            hasUpdates = true;
          }
        }

        // Copia anche altri campi utili se mancanti
        if (template.icon && !existingTask.icon) updates.icon = template.icon;
        if (template.color && !existingTask.color) updates.color = template.color;
        if (template.description && !existingTask.description) updates.description = template.description;

        if (hasUpdates || Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();
          await tasksColl.updateOne(
            { id: taskId },
            { $set: updates }
          );
          updated++;
          console.log(`   ✅ Aggiornato task ${taskId}: aggiunti ${Object.keys(updates).length} campi`);
        }
      } else {
        // Task non esiste, crealo completo
        const newTask = {
          _id: template._id || taskId,
          id: taskId,
          type: template.type !== undefined ? template.type : 3, // Default DataRequest
          templateId: template.templateId || null,
          label: template.label || template.name || 'Unnamed Task',
          ...(template.icon && { icon: template.icon }),
          ...(template.color && { color: template.color }),
          ...(template.description && { description: template.description }),
          ...(template.valueSchema && { valueSchema: template.valueSchema }),
          ...(template.signature && { signature: template.signature }),
          ...(template.scope && { scope: template.scope }),
          ...(template.industry && { industry: template.industry }),
          ...(template.mainData && { mainData: template.mainData }),
          ...(template.subDataIds && { subDataIds: template.subDataIds }),
          ...(template.constraints && { constraints: template.constraints }),
          ...(template.examples && { examples: template.examples }),
          ...(template.dataContracts && { dataContracts: template.dataContracts }),
          ...(template.patterns && { patterns: template.patterns }),
          ...(template.stepPrompts && { stepPrompts: template.stepPrompts }),
          ...(template.contexts && { contexts: template.contexts }),
          ...(template.name && { name: template.name }),
          ...(template.steps && { steps: template.steps }),
          createdAt: template.createdAt || new Date(),
          updatedAt: new Date()
        };

        await tasksColl.insertOne(newTask);
        created++;
        console.log(`   ✅ Creato task ${taskId} con tutti i campi`);
      }
    }

    console.log(`\n✅ Migrazione factory completata:`);
    console.log(`   - Tasks aggiornati: ${updated}`);
    console.log(`   - Tasks creati: ${created}`);

    return { updated, created };
  } finally {
    await client.close();
  }
}

async function completeProjectsMigration() {
  console.log('\n📦 Completando migrazione Progetti...\n');
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const catalogDb = client.db(dbProjects);
    const catalog = catalogDb.collection('projects_catalog');
    const projects = await catalog.find({}).toArray();

    console.log(`📋 Trovati ${projects.length} progetti\n`);

    let totalUpdated = 0;
    let totalCreated = 0;

    for (const project of projects) {
      if (!project.dbName) {
        console.log(`   ⚠️  Progetto ${project.projectName} non ha dbName, skip`);
        continue;
      }

      try {
        const projDb = client.db(project.dbName);
        const taskTemplates = await projDb.collection('Task_Templates').find({}).toArray();
        const tasksColl = projDb.collection('tasks');

        if (taskTemplates.length === 0) {
          console.log(`   ⏭️  ${project.dbName}: nessun Task_Templates, skip`);
          continue;
        }

        console.log(`   📂 ${project.dbName}: ${taskTemplates.length} template`);

        let updated = 0;
        let created = 0;

        for (const template of taskTemplates) {
          const taskId = template.id || template._id?.toString();
          if (!taskId) continue;

          const existingTask = await tasksColl.findOne({ id: taskId });

          if (existingTask) {
            const updates = {};
            for (const field of FIELDS_TO_COPY) {
              if (template[field] !== undefined && existingTask[field] === undefined) {
                updates[field] = template[field];
              }
            }

            if (Object.keys(updates).length > 0) {
              updates.updatedAt = new Date();
              await tasksColl.updateOne({ id: taskId }, { $set: updates });
              updated++;
            }
          } else {
            const newTask = {
              _id: template._id || taskId,
              id: taskId,
              type: template.type !== undefined ? template.type : 3,
              templateId: template.templateId || null,
              label: template.label || template.name || 'Unnamed Task',
              ...(template.icon && { icon: template.icon }),
              ...(template.color && { color: template.color }),
              ...(template.description && { description: template.description }),
              ...(template.valueSchema && { valueSchema: template.valueSchema }),
              ...(template.signature && { signature: template.signature }),
              ...(template.scope && { scope: template.scope }),
              ...(template.industry && { industry: template.industry }),
              ...(template.mainData && { mainData: template.mainData }),
              ...(template.subDataIds && { subDataIds: template.subDataIds }),
              ...(template.constraints && { constraints: template.constraints }),
              ...(template.examples && { examples: template.examples }),
              ...(template.dataContracts && { dataContracts: template.dataContracts }),
              ...(template.patterns && { patterns: template.patterns }),
              ...(template.stepPrompts && { stepPrompts: template.stepPrompts }),
              ...(template.contexts && { contexts: template.contexts }),
              ...(template.name && { name: template.name }),
              ...(template.steps && { steps: template.steps }),
              createdAt: template.createdAt || new Date(),
              updatedAt: new Date()
            };

            await tasksColl.insertOne(newTask);
            created++;
          }
        }

        totalUpdated += updated;
        totalCreated += created;
        console.log(`      ✅ Aggiornati: ${updated}, Creati: ${created}`);

      } catch (error) {
        console.error(`   ❌ Errore in ${project.dbName}:`, error.message);
      }
    }

    console.log(`\n✅ Migrazione progetti completata:`);
    console.log(`   - Tasks aggiornati totali: ${totalUpdated}`);
    console.log(`   - Tasks creati totali: ${totalCreated}`);

  } finally {
    await client.close();
  }
}

async function main() {
  console.log('🚀 Starting Complete Tasks Migration...\n');

  try {
    const factoryResult = await completeFactoryMigration();
    await completeProjectsMigration();

    console.log('\n' + '='.repeat(70));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(70));
    console.log(`Factory: ${factoryResult.updated} aggiornati, ${factoryResult.created} creati`);
    console.log('='.repeat(70));

    console.log('\n🎉 Migrazione completata!');
    console.log('\n✅ Ora Tasks ha tutti i campi di Task_Templates');
    console.log('✅ Possiamo migrare gli endpoint a Tasks');

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

