/**
 * Verifica: Controlla quali action non sono state mappate correttamente
 *
 * Esegui con: node backend/migrations/verify_action_mapping.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verifyActionMapping() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // Controlla Task_Templates originale
    const originalColl = db.collection('Task_Templates');
    const originalActions = await originalColl.find({
      $or: [
        { taskType: { $regex: /^action$/i } },
        { taskType: 'Action' }
      ]
    }).toArray();

    console.log(`📋 Trovate ${originalActions.length} action in Task_Templates originale\n`);

    if (originalActions.length > 0) {
      console.log('📝 Action trovate:');
      originalActions.forEach((action, idx) => {
        console.log(`   ${idx + 1}. ${action.id || action.name}: "${action.label}" (type: ${action.type}, taskType: ${action.taskType})`);
      });
    }

    // Controlla Tasks migrati
    const tasksColl = db.collection('Tasks');
    const allTasks = await tasksColl.find({}).toArray();

    console.log(`\n📋 Trovati ${allTasks.length} task in Tasks\n`);

    // Cerca task con type 0 che potrebbero essere action
    const potentialActions = allTasks.filter(t =>
      t.type === 0 && (
        (t.id && (t.id.includes('template') || t.id.includes('Action'))) ||
        (t.label && (
          t.label.toLowerCase().includes('send') ||
          t.label.toLowerCase().includes('escalate') ||
          t.label.toLowerCase().includes('log') ||
          t.label.toLowerCase().includes('jump') ||
          t.label.toLowerCase().includes('hang') ||
          t.label.toLowerCase().includes('wait') ||
          t.label.toLowerCase().includes('play') ||
          t.label.toLowerCase().includes('clear') ||
          t.label.toLowerCase().includes('assign')
        ))
      )
    );

    console.log(`🔍 Trovati ${potentialActions.length} task con type 0 che potrebbero essere action:\n`);
    potentialActions.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ${task.id}: "${task.label}" (type: ${task.type})`);
    });

    // Statistiche type
    const typeStats = {};
    allTasks.forEach(t => {
      const type = t.type || 'undefined';
      typeStats[type] = (typeStats[type] || 0) + 1;
    });

    console.log(`\n📊 Distribuzione type in Tasks:`);
    Object.entries(typeStats).sort((a, b) => {
      const aNum = typeof a[0] === 'number' ? a[0] : -999;
      const bNum = typeof b[0] === 'number' ? b[0] : -999;
      return aNum - bNum;
    }).forEach(([type, count]) => {
      console.log(`   type ${type}: ${count}`);
    });

  } catch (error) {
    console.error('\n❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  verifyActionMapping()
    .then(() => {
      console.log('\n✅ Script completato');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { verifyActionMapping };

