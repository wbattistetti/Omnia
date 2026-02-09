/**
 * Script: Confronta Task_Templates vs Tasks per vedere quali campi mancano
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function compare() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // Prendi un documento da Task_Templates
    const taskTemplate = await db.collection('Task_Templates').findOne({});
    if (!taskTemplate) {
      console.log('❌ Nessun documento in Task_Templates');
      return;
    }

    // Prendi lo stesso documento da Tasks (stesso id)
    const task = await db.collection('Tasks').findOne({ id: taskTemplate.id });

    console.log('📋 CONFRONTO CAMPI:\n');

    const taskTemplateKeys = new Set(Object.keys(taskTemplate));
    const taskKeys = task ? new Set(Object.keys(task)) : new Set();

    console.log(`Task_Templates ha ${taskTemplateKeys.size} campi`);
    console.log(`Tasks ha ${taskKeys.size} campi\n`);

    // Campi in Task_Templates ma NON in Tasks
    const missingInTasks = [...taskTemplateKeys].filter(k => !taskKeys.has(k) && k !== '_id');
    console.log(`❌ Campi in Task_Templates ma MANCANTI in Tasks (${missingInTasks.length}):`);
    missingInTasks.forEach(key => {
      const value = taskTemplate[key];
      const valueType = Array.isArray(value) ? 'array' : typeof value;
      const valuePreview = valueType === 'object' ? JSON.stringify(value).substring(0, 100) : String(value).substring(0, 50);
      console.log(`   - ${key}: ${valueType} = ${valuePreview}`);
    });

    // Campi in Tasks ma NON in Task_Templates
    const missingInTaskTemplates = [...taskKeys].filter(k => !taskTemplateKeys.has(k) && k !== '_id');
    if (missingInTaskTemplates.length > 0) {
      console.log(`\n✅ Campi in Tasks ma NON in Task_Templates (${missingInTaskTemplates.length}):`);
      missingInTaskTemplates.forEach(key => {
        const value = task[key];
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        const valuePreview = valueType === 'object' ? JSON.stringify(value).substring(0, 100) : String(value).substring(0, 50);
        console.log(`   - ${key}: ${valueType} = ${valuePreview}`);
      });
    }

    // Campi comuni con valori diversi
    if (task) {
      const commonKeys = [...taskTemplateKeys].filter(k => taskKeys.has(k) && k !== '_id' && k !== 'updatedAt');
      const different = [];
      commonKeys.forEach(key => {
        const ttValue = JSON.stringify(taskTemplate[key]);
        const tValue = JSON.stringify(task[key]);
        if (ttValue !== tValue) {
          different.push({ key, taskTemplate: taskTemplate[key], task: task[key] });
        }
      });

      if (different.length > 0) {
        console.log(`\n⚠️  Campi comuni con VALORI DIVERSI (${different.length}):`);
        different.slice(0, 5).forEach(({ key, taskTemplate: ttVal, task: tVal }) => {
          console.log(`   - ${key}:`);
          console.log(`     Task_Templates: ${JSON.stringify(ttVal).substring(0, 80)}`);
          console.log(`     Tasks: ${JSON.stringify(tVal).substring(0, 80)}`);
        });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('💡 CONCLUSIONE:');
    console.log('='.repeat(70));
    if (missingInTasks.length > 0) {
      console.log(`❌ Tasks NON ha tutti i campi di Task_Templates!`);
      console.log(`   Mancano ${missingInTasks.length} campi importanti.`);
      console.log(`\n✅ SOLUZIONE:`);
      console.log(`   1. Aggiungere i campi mancanti a Tasks (migrazione completa)`);
      console.log(`   2. O mantenere backward compatibility leggendo da entrambe`);
    } else {
      console.log(`✅ Tasks ha tutti i campi necessari!`);
      console.log(`   Possiamo migrare completamente a Tasks.`);
    }

  } finally {
    await client.close();
  }
}

if (require.main === module) {
  compare().catch(console.error);
}

module.exports = { compare };

