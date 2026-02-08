/**
 * Verifica se ci sono task con label che suggeriscono date
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkDateTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbFactory);

    const tasks = await db.collection('Tasks').find({
      type: 3,
      label: { $regex: /date|data|birth|nascita/i }
    }).toArray();

    console.log(`Task con label date/data/birth: ${tasks.length}\n`);

    if (tasks.length > 0) {
      tasks.forEach(t => {
        console.log(`  - ${t.label || 'N/A'} (${t.id})`);
        console.log(`    mainData: ${t.mainData ? 'YES' : 'NO'}`);
        if (t.mainData && Array.isArray(t.mainData) && t.mainData.length > 0) {
          const main = t.mainData[0];
          console.log(`    SubData count: ${main.subData?.length || 0}`);
        }
        console.log();
      });
    }

    await client.close();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

if (require.main === module) {
  checkDateTasks().catch(console.error);
}

module.exports = { checkDateTasks };
