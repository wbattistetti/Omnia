/**
 * Analisi dettagliata dei task DataRequest con mainData per verificare struttura completa
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyzeDetailed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const collection = factoryDb.collection('Tasks');

    // Find all type: 3 with mainData
    const tasksWithMainData = await collection.find({
      type: 3,
      mainData: { $exists: true, $ne: null }
    }).toArray();

    console.log(`📋 Found ${tasksWithMainData.length} tasks with mainData\n`);

    for (const task of tasksWithMainData) {
      console.log('='.repeat(80));
      console.log(`Task ID: ${task.id || task._id}`);
      console.log(`Label: ${task.label || 'N/A'}`);
      console.log(`TemplateId: ${task.templateId || 'null'}`);
      console.log(`MainData count: ${task.mainData?.length || 0}\n`);

      if (task.mainData && Array.isArray(task.mainData)) {
        for (let i = 0; i < task.mainData.length; i++) {
          const mainNode = task.mainData[i];
          console.log(`MainData[${i}]:`);
          console.log(`  ID: ${mainNode.id || 'N/A'}`);
          console.log(`  Label: ${mainNode.label || mainNode.name || 'N/A'}`);
          console.log(`  Type: ${mainNode.type || 'N/A'}`);
          console.log(`  SubData count: ${mainNode.subData?.length || 0}`);

          if (mainNode.subData && Array.isArray(mainNode.subData)) {
            console.log(`  SubData:`);
            mainNode.subData.forEach((sub, idx) => {
              console.log(`    [${idx}] ID: ${sub.id || 'N/A'}, Label: ${sub.label || sub.name || 'N/A'}`);
            });
          }

          // Check if it's a date type
          const label = (mainNode.label || mainNode.name || '').toLowerCase();
          const isDate = label.includes('date') || label.includes('data') || label.includes('birth') || label.includes('nascita');

          if (isDate) {
            console.log(`  ⚠️  DATE TYPE DETECTED`);
            const subDataLabels = (mainNode.subData || []).map(s => (s.label || s.name || '').toLowerCase());
            const hasGiorno = subDataLabels.some(l => l.includes('giorno') || l.includes('day'));
            const hasMese = subDataLabels.some(l => l.includes('mese') || l.includes('month'));
            const hasAnno = subDataLabels.some(l => l.includes('anno') || l.includes('year'));

            console.log(`  Sub-data analysis:`);
            console.log(`    Giorno/Day: ${hasGiorno ? '✅' : '❌'}`);
            console.log(`    Mese/Month: ${hasMese ? '✅' : '❌'}`);
            console.log(`    Anno/Year: ${hasAnno ? '✅' : '❌'}`);

            if (!hasGiorno || !hasMese || !hasAnno) {
              console.log(`  ⚠️  PROBLEMA: Date incompleta - mancano sub-data!`);
            }
          }
          console.log();
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

if (require.main === module) {
  analyzeDetailed().catch(console.error);
}

module.exports = { analyzeDetailed };
