/**
 * Script: Genera embedding per tutti i task esistenti nel database Factory
 *
 * Questo script:
 * 1. Carica tutti i task di tipo 3 (UtteranceInterpretation) dal database Factory
 * 2. Calcola l'embedding per ogni task usando il servizio Python FastAPI
 * 3. Salva gli embedding nella collection 'embeddings' in MongoDB
 *
 * Usage:
 *   node generateTaskEmbeddings.js
 */

const { MongoClient } = require('mongodb');
// Use native fetch (Node.js 18+) instead of node-fetch
const fetch = globalThis.fetch || require('node-fetch');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';

async function generateAllTaskEmbeddings() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');

    // Carica tutti i task di tipo 3 (UtteranceInterpretation)
    const tasks = await tasksCollection.find({ type: 3 }).toArray();
    console.log(`📋 Trovati ${tasks.length} task di tipo 3 (UtteranceInterpretation)\n`);

    if (tasks.length === 0) {
      console.log('✅ Nessun task da processare.');
      return;
    }

    // Verifica che il servizio embedding sia disponibile
    try {
      // Prova a chiamare l'endpoint di compute con un testo di test
      const testResponse = await fetch(`${embeddingServiceUrl}/api/embeddings/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
        signal: AbortSignal.timeout(5000)
      });
      if (!testResponse.ok) {
        throw new Error('Embedding service not available');
      }
      console.log('✅ Servizio embedding disponibile\n');
    } catch (error) {
      console.error('❌ ERRORE: Servizio embedding non disponibile');
      console.error(`   Assicurati che il servizio Python FastAPI sia in esecuzione su ${embeddingServiceUrl}`);
      console.error(`   Avvia con: cd newBackend && python -m uvicorn app:app --reload --port 8000`);
      process.exit(1);
    }

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskId = task.id || task._id?.toString();
      const taskLabel = task.label;

      if (!taskId || !taskLabel) {
        console.log(`⚠️  [${i + 1}/${tasks.length}] Skipping task senza ID o label`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`[${i + 1}/${tasks.length}] Processing: "${taskLabel.substring(0, 50)}" (${taskId})`);

        // 1. Calcola embedding
        const computeResponse = await fetch(`${embeddingServiceUrl}/api/embeddings/compute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: taskLabel.trim() }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!computeResponse.ok) {
          const errorText = await computeResponse.text();
          throw new Error(`Compute failed: ${computeResponse.status} ${errorText}`);
        }

        const { embedding } = await computeResponse.json();

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error('Invalid embedding returned');
        }

        // 2. Salva in MongoDB
        const now = new Date();
        const result = await embeddingsCollection.updateOne(
          { id: taskId, type: 'task' },
          {
            $set: {
              id: taskId,
              type: 'task',
              text: taskLabel.trim(),
              embedding: embedding,
              model: 'paraphrase-multilingual-MiniLM-L12-v2',
              updatedAt: now
            },
            $setOnInsert: {
              createdAt: now
            }
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`   ✅ Created embedding (${embedding.length} dimensions)`);
        } else if (result.modifiedCount > 0) {
          console.log(`   ✅ Updated embedding (${embedding.length} dimensions)`);
        } else {
          console.log(`   ⚠️  No changes (embedding already exists)`);
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failedCount++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`📋 Total: ${tasks.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verifica finale
    const finalCount = await embeddingsCollection.countDocuments({ type: 'task' });
    console.log(`✅ Embedding salvati nel database: ${finalCount}`);

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Connessione chiusa');
  }
}

generateAllTaskEmbeddings();
