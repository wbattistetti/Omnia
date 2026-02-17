// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Script: Verifica quanti template vengono caricati e se l'ID dell'embedding corrisponde
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkTemplateLoading() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');

    // 1. Conta tutti i task nel database
    const allTasks = await tasksCollection.find({}).toArray();
    console.log(`📋 Task totali nel database: ${allTasks.length}\n`);

    // 2. Verifica quanti hanno campo 'id' e quanti solo '_id'
    let withId = 0;
    let onlyObjectId = 0;
    const taskIds = new Map();

    allTasks.forEach(task => {
      const id = task.id || task._id?.toString();
      if (id) {
        taskIds.set(id, task);
        if (task.id) {
          withId++;
        } else {
          onlyObjectId++;
        }
      }
    });

    console.log(`📊 Statistiche task:`);
    console.log(`   Con campo 'id': ${withId}`);
    console.log(`   Solo '_id' (ObjectId): ${onlyObjectId}`);
    console.log(`   Totali mappati: ${taskIds.size}\n`);

    // 3. Verifica l'ID trovato dall'embedding matching
    const embeddingMatchId = '845c56c9-1b48-41a8-893f-d2b643b416cf';
    const templateFromFigureId = '009e5163-6040-4d57-864c-8de70892b310';

    console.log(`🔍 Verifica ID specifici:\n`);
    console.log(`   Embedding match ID: ${embeddingMatchId}`);
    const taskFromEmbedding = taskIds.get(embeddingMatchId);
    if (taskFromEmbedding) {
      console.log(`   ✅ Trovato nel database`);
      console.log(`      Label: "${taskFromEmbedding.label || 'N/A'}"`);
      console.log(`      Type: ${taskFromEmbedding.type || 'N/A'}`);
      console.log(`      _id: ${taskFromEmbedding._id || 'N/A'}`);
    } else {
      console.log(`   ❌ NON trovato nel database`);
    }

    console.log(`\n   Template dalla figura ID: ${templateFromFigureId}`);
    const taskFromFigure = taskIds.get(templateFromFigureId);
    if (taskFromFigure) {
      console.log(`   ✅ Trovato nel database`);
      console.log(`      Label: "${taskFromFigure.label || 'N/A'}"`);
      console.log(`      Type: ${taskFromFigure.type || 'N/A'}`);
      console.log(`      _id: ${taskFromFigure._id || 'N/A'}`);
    } else {
      console.log(`   ❌ NON trovato nel database`);
    }

    // 4. Verifica embedding per entrambi gli ID
    console.log(`\n🔍 Verifica embedding:\n`);

    const embedding1 = await embeddingsCollection.findOne({ id: embeddingMatchId, type: 'task' });
    if (embedding1) {
      console.log(`   ✅ Embedding trovato per ID ${embeddingMatchId}`);
      console.log(`      Text: "${embedding1.text || 'N/A'}"`);
      console.log(`      OriginalText: "${embedding1.originalText || 'N/A'}"`);
    } else {
      console.log(`   ❌ Embedding NON trovato per ID ${embeddingMatchId}`);
    }

    const embedding2 = await embeddingsCollection.findOne({ id: templateFromFigureId, type: 'task' });
    if (embedding2) {
      console.log(`   ✅ Embedding trovato per ID ${templateFromFigureId}`);
      console.log(`      Text: "${embedding2.text || 'N/A'}"`);
      console.log(`      OriginalText: "${embedding2.originalText || 'N/A'}"`);
    } else {
      console.log(`   ❌ Embedding NON trovato per ID ${templateFromFigureId}`);
    }

    // 5. Lista tutti i task con i loro ID
    console.log(`\n📝 Lista completa task (primi 20):\n`);
    allTasks.slice(0, 20).forEach((task, index) => {
      const id = task.id || task._id?.toString();
      console.log(`   ${index + 1}. ID: ${id}`);
      console.log(`      Label: "${task.label || 'N/A'}"`);
      console.log(`      Type: ${task.type || 'N/A'}`);
      console.log(`      _id: ${task._id || 'N/A'}`);
      console.log('');
    });

    if (allTasks.length > 20) {
      console.log(`   ... e altri ${allTasks.length - 20} task\n`);
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Connessione chiusa');
  }
}

checkTemplateLoading();
