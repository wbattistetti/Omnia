/**
 * Script: Genera embeddings di esempio per classificazione TaskType
 *
 * Questo script:
 * 1. Definisce esempi rappresentativi per ogni TaskType (SayMessage, UtteranceInterpretation, ecc.)
 * 2. Calcola l'embedding per ogni esempio usando il servizio Python FastAPI
 * 3. Salva gli embedding nella collection 'embeddings' con type='taskType'
 *
 * Usage:
 *   node generateTaskTypeEmbeddings.js
 */

const { MongoClient } = require('mongodb');
const fetch = globalThis.fetch || require('node-fetch');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';

/**
 * Esempi rappresentativi per ogni TaskType
 * Questi esempi coprono le variazioni linguistiche principali (IT, EN, PT)
 */
const TASKTYPE_EXAMPLES = {
  // TaskType.SayMessage = 0
  0: [
    { text: 'saluta', language: 'IT' },
    { text: 'presentati', language: 'IT' },
    { text: 'informa', language: 'IT' },
    { text: 'comunica', language: 'IT' },
    { text: 'di ciao', language: 'IT' },
    { text: 'devi dire', language: 'IT' },
    { text: 'greet', language: 'EN' },
    { text: 'introduce yourself', language: 'EN' },
    { text: 'inform', language: 'EN' },
    { text: 'communicate', language: 'EN' },
    { text: 'say hello', language: 'EN' },
    { text: 'cumprimente', language: 'PT' },
    { text: 'apresente-se', language: 'PT' },
    { text: 'informe', language: 'PT' },
  ],

  // TaskType.UtteranceInterpretation = 3
  3: [
    { text: 'chiedi', language: 'IT' },
    { text: 'quale è', language: 'IT' },
    { text: 'qual è', language: 'IT' },
    { text: 'raccogli', language: 'IT' },
    { text: 'acquisisci', language: 'IT' },
    { text: 'domanda', language: 'IT' },
    { text: 'richiedi', language: 'IT' },
    { text: 'quando è', language: 'IT' },
    { text: 'mi dici', language: 'IT' },
    { text: 'vorrei sapere', language: 'IT' },
    { text: 'serve sapere', language: 'IT' },
    { text: 'dimmi', language: 'IT' },
    { text: 'ask', language: 'EN' },
    { text: 'what is', language: 'EN' },
    { text: 'which is', language: 'EN' },
    { text: 'collect', language: 'EN' },
    { text: 'acquire', language: 'EN' },
    { text: 'request', language: 'EN' },
    { text: 'when is', language: 'EN' },
    { text: 'tell me', language: 'EN' },
    { text: 'i want to know', language: 'EN' },
    { text: 'i need to know', language: 'EN' },
    { text: 'give me', language: 'EN' },
    { text: 'pergunte', language: 'PT' },
    { text: 'qual é', language: 'PT' },
    { text: 'colete', language: 'PT' },
    { text: 'adquira', language: 'PT' },
    { text: 'me diga', language: 'PT' },
    { text: 'quero saber', language: 'PT' },
    { text: 'preciso saber', language: 'PT' },
  ],

  // TaskType.BackendCall = 4
  4: [
    { text: 'chiama', language: 'IT' },
    { text: 'recupera', language: 'IT' },
    { text: 'verifica', language: 'IT' },
    { text: 'call', language: 'EN' },
    { text: 'retrieve', language: 'EN' },
    { text: 'check', language: 'EN' },
    { text: 'chame', language: 'PT' },
    { text: 'recupere', language: 'PT' },
    { text: 'verifique', language: 'PT' },
  ],

  // TaskType.ClassifyProblem = 5
  5: [
    { text: 'chiedi', language: 'IT' },
    { text: 'individua', language: 'IT' },
    { text: 'classifica', language: 'IT' },
    { text: 'ask', language: 'EN' },
    { text: 'identify', language: 'EN' },
    { text: 'classify', language: 'EN' },
    { text: 'pergunte', language: 'PT' },
    { text: 'identifique', language: 'PT' },
    { text: 'classifique', language: 'PT' },
  ],

  // TaskType.AIAgent = 6
  6: [
    { text: 'usa l\'AI', language: 'IT' },
    { text: 'agente AI', language: 'IT' },
    { text: 'intelligenza artificiale', language: 'IT' },
    { text: 'use AI', language: 'EN' },
    { text: 'AI agent', language: 'EN' },
    { text: 'artificial intelligence', language: 'EN' },
    { text: 'use IA', language: 'PT' },
    { text: 'agente IA', language: 'PT' },
  ],

  // TaskType.Summarizer = 7
  7: [
    { text: 'riassumi', language: 'IT' },
    { text: 'fai un riassunto', language: 'IT' },
    { text: 'summarize', language: 'EN' },
    { text: 'make a summary', language: 'EN' },
    { text: 'resuma', language: 'PT' },
    { text: 'faça um resumo', language: 'PT' },
  ],

  // TaskType.Negotiation = 8
  8: [
    { text: 'negozia', language: 'IT' },
    { text: 'tratta', language: 'IT' },
    { text: 'negotiate', language: 'EN' },
    { text: 'deal', language: 'EN' },
    { text: 'negocie', language: 'PT' },
    { text: 'negociar', language: 'PT' },
  ],
};

async function generateTaskTypeEmbeddings() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const embeddingsCollection = factoryDb.collection('embeddings');

    // Verifica che il servizio embedding sia disponibile
    try {
      const testResponse = await fetch(`${embeddingServiceUrl}/api/embeddings/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
        signal: AbortSignal.timeout(5000)
      });
      if (!testResponse.ok) {
        throw new Error(`Test failed: ${testResponse.status} ${testResponse.statusText}`);
      }
      console.log('✅ Servizio embedding disponibile\n');
    } catch (error) {
      console.error('❌ Servizio embedding non disponibile:', error.message);
      console.error(`   Assicurati che il servizio Python FastAPI sia in esecuzione su ${embeddingServiceUrl}`);
      process.exit(1);
    }

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Processa ogni TaskType
    for (const [taskTypeStr, examples] of Object.entries(TASKTYPE_EXAMPLES)) {
      const taskType = parseInt(taskTypeStr, 10);
      console.log(`\n📋 Processing TaskType ${taskType} (${examples.length} examples)...`);

      for (let i = 0; i < examples.length; i++) {
        const example = examples[i];
        const exampleId = `taskType_${taskType}_${i + 1}_${example.language}`;

        try {
          // 1. Calcola embedding
          const computeResponse = await fetch(`${embeddingServiceUrl}/api/embeddings/compute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: example.text }),
            signal: AbortSignal.timeout(30000)
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
            { id: exampleId, type: 'taskType' },
            {
              $set: {
                id: exampleId,
                type: 'taskType',
                text: example.text.trim(),
                originalText: example.text.trim(),
                embedding: embedding,
                taskType: taskType, // ✅ Campo aggiuntivo per TaskType enum
                language: example.language, // ✅ Campo aggiuntivo per lingua
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
            totalCreated++;
            console.log(`  ✅ Created: "${example.text}" (${example.language})`);
          } else if (result.modifiedCount > 0) {
            totalUpdated++;
            console.log(`  🔄 Updated: "${example.text}" (${example.language})`);
          }

          totalProcessed++;
        } catch (error) {
          totalErrors++;
          console.error(`  ❌ Error processing "${example.text}":`, error.message);
        }
      }
    }

    console.log(`\n✅ Completato:`);
    console.log(`   Processati: ${totalProcessed}`);
    console.log(`   Creati: ${totalCreated}`);
    console.log(`   Aggiornati: ${totalUpdated}`);
    console.log(`   Errori: ${totalErrors}`);

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  generateTaskTypeEmbeddings();
}

module.exports = { generateTaskTypeEmbeddings, TASKTYPE_EXAMPLES };
