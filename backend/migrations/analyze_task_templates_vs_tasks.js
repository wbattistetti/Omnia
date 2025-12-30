/**
 * Script di analisi: Verifica differenze tra Task_Templates e Tasks
 *
 * Questo script aiuta a capire:
 * 1. Cosa c'è in Task_Templates vs Tasks
 * 2. Se ci sono duplicati
 * 3. Quali endpoint devono essere migrati
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyze() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // Analizza Task_Templates
    const taskTemplates = await db.collection('Task_Templates').find({}).toArray();
    console.log(`📋 Task_Templates: ${taskTemplates.length} documenti`);

    if (taskTemplates.length > 0) {
      console.log('\n   Campi presenti nei primi 3 documenti:');
      taskTemplates.slice(0, 3).forEach((t, idx) => {
        console.log(`   ${idx + 1}. ID: ${t.id || t._id}, Keys: ${Object.keys(t).join(', ')}`);
        console.log(`      - type: ${t.type}, templateId: ${t.templateId || 'N/A'}, scope: ${t.scope || 'N/A'}`);
      });
    }

    // Analizza Tasks
    const tasks = await db.collection('Tasks').find({}).toArray();
    console.log(`\n📋 Tasks: ${tasks.length} documenti`);

    if (tasks.length > 0) {
      console.log('\n   Campi presenti nei primi 3 documenti:');
      tasks.slice(0, 3).forEach((t, idx) => {
        console.log(`   ${idx + 1}. ID: ${t.id || t._id}, Keys: ${Object.keys(t).join(', ')}`);
        console.log(`      - type: ${t.type}, templateId: ${t.templateId || 'N/A'}, scope: ${t.scope || 'N/A'}`);
      });
    }

    // Verifica duplicati (stesso id in entrambe)
    const taskTemplateIds = new Set(taskTemplates.map(t => t.id || t._id?.toString()));
    const taskIds = new Set(tasks.map(t => t.id || t._id?.toString()));
    const duplicates = [...taskTemplateIds].filter(id => taskIds.has(id));

    console.log(`\n🔍 Duplicati trovati: ${duplicates.length}`);
    if (duplicates.length > 0) {
      console.log('   IDs duplicati:', duplicates.slice(0, 10).join(', '));
    }

    // Analizza scope
    const taskTemplatesByScope = {};
    taskTemplates.forEach(t => {
      const scope = t.scope || 'unknown';
      taskTemplatesByScope[scope] = (taskTemplatesByScope[scope] || 0) + 1;
    });

    console.log(`\n📊 Task_Templates per scope:`);
    Object.entries(taskTemplatesByScope).forEach(([scope, count]) => {
      console.log(`   - ${scope}: ${count}`);
    });

    const tasksByScope = {};
    tasks.forEach(t => {
      const scope = t.scope || 'unknown';
      tasksByScope[scope] = (tasksByScope[scope] || 0) + 1;
    });

    console.log(`\n📊 Tasks per scope:`);
    Object.entries(tasksByScope).forEach(([scope, count]) => {
      console.log(`   - ${scope}: ${count}`);
    });

  } finally {
    await client.close();
  }
}

if (require.main === module) {
  analyze().catch(console.error);
}

module.exports = { analyze };

