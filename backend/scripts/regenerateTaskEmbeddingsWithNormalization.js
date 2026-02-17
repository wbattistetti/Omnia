// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Script: Rigenera embedding per tutti i task con testo normalizzato
 *
 * Questo script:
 * 1. Carica tutti i task di tipo 3 (UtteranceInterpretation) dal database Factory
 * 2. Normalizza il testo di ogni task usando embeddingTextNormalization
 * 3. Rigenera l'embedding usando il testo normalizzato
 * 4. Aggiorna il database con embedding e testo normalizzato
 *
 * Usage:
 *   node regenerateTaskEmbeddingsWithNormalization.js --dry-run    # Solo visualizza cosa verrebbe rigenerato
 *   node regenerateTaskEmbeddingsWithNormalization.js --confirm    # Esegue la rigenerazione
 */

const { MongoClient } = require('mongodb');
const { normalizeTextForEmbedding } = require('../utils/embeddingTextNormalization');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const pythonServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';

async function regenerateTaskEmbeddingsWithNormalization() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirm = args.includes('--confirm');

  if (!isDryRun && !isConfirm) {
    console.error('❌ ERRORE: Devi specificare --dry-run o --confirm');
    console.log('\nUsage:');
    console.log('  node regenerateTaskEmbeddingsWithNormalization.js --dry-run    # Solo visualizza');
    console.log('  node regenerateTaskEmbeddingsWithNormalization.js --confirm    # Esegue rigenerazione');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');
    const embeddingsCollection = factoryDb.collection('embeddings');

    // Trova tutti i task di tipo 3
    const tasks = await tasksCollection.find({ type: 3 }).toArray();
    console.log(`📋 Trovati ${tasks.length} task di tipo 3 (UtteranceInterpretation)\n`);

    if (tasks.length === 0) {
      console.log('✅ Nessun task da processare.');
      return;
    }

    const results = [];

    for (const task of tasks) {
      const taskId = task._id?.toString() || task.id;
      const originalLabel = task.label || '';

      if (!originalLabel || originalLabel.trim().length === 0) {
        console.log(`⚠️  Task ${taskId}: label vuota, skip`);
        continue;
      }

      // Normalizza il testo
      const normalizedLabel = normalizeTextForEmbedding(originalLabel);

      // Verifica se l'embedding esiste già
      const existingEmbedding = await embeddingsCollection.findOne({ id: taskId, type: 'task' });

      results.push({
        taskId,
        originalLabel,
        normalizedLabel,
        hasExistingEmbedding: !!existingEmbedding,
        needsRegeneration: !existingEmbedding || existingEmbedding.text !== normalizedLabel
      });
    }

    // Mostra risultati
    console.log('📝 Analisi task:\n');
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ID: ${result.taskId}`);
      console.log(`     Original: "${result.originalLabel.substring(0, 60)}"`);
      console.log(`     Normalized: "${result.normalizedLabel.substring(0, 60)}"`);
      console.log(`     Has embedding: ${result.hasExistingEmbedding ? '✅' : '❌'}`);
      console.log(`     Needs regeneration: ${result.needsRegeneration ? '✅' : '❌'}`);
      console.log('');
    });

    const needsRegeneration = results.filter(r => r.needsRegeneration);
    console.log(`\n📊 Riepilogo:`);
    console.log(`   Total tasks: ${results.length}`);
    console.log(`   Needs regeneration: ${needsRegeneration.length}`);
    console.log(`   Already up-to-date: ${results.length - needsRegeneration.length}\n`);

    if (isDryRun) {
      console.log('🔍 DRY RUN: Nessuna modifica effettuata.');
      console.log('   Per eseguire la rigenerazione, usa: --confirm');
      return;
    }

    if (isConfirm && needsRegeneration.length > 0) {
      console.log('\n⚠️  ATTENZIONE: Stai per rigenerare embedding per questi task!');
      console.log('   Premi Ctrl+C entro 5 secondi per annullare...\n');

      await new Promise(resolve => setTimeout(resolve, 5000));

      let successCount = 0;
      let errorCount = 0;

      for (const result of needsRegeneration) {
        try {
          console.log(`\n🔄 Processing task ${result.taskId}...`);

          // 1. Calcola embedding usando testo normalizzato
          const computeResponse = await fetch(`${pythonServiceUrl}/api/embeddings/compute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: result.normalizedLabel }),
            signal: AbortSignal.timeout(30000)
          });

          if (!computeResponse.ok) {
            const errorText = await computeResponse.text();
            throw new Error(`Failed to compute embedding: ${computeResponse.status} ${errorText}`);
          }

          const { embedding } = await computeResponse.json();

          if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
            throw new Error('Invalid embedding returned from service');
          }

          // 2. Salva embedding in MongoDB
          await embeddingsCollection.updateOne(
            { id: result.taskId, type: 'task' },
            {
              $set: {
                id: result.taskId,
                type: 'task',
                text: result.normalizedLabel, // ✅ Normalized text
                originalText: result.originalLabel, // ✅ Original text for reference
                embedding: embedding,
                model: 'paraphrase-multilingual-MiniLM-L12-v2',
                updatedAt: new Date()
              },
              $setOnInsert: {
                createdAt: new Date()
              }
            },
            { upsert: true }
          );

          console.log(`✅ Task ${result.taskId}: Embedding rigenerato`);
          successCount++;
        } catch (error) {
          console.error(`❌ Task ${result.taskId}: Errore - ${error.message}`);
          errorCount++;
        }
      }

      console.log(`\n✅ Rigenerazione completata:`);
      console.log(`   Success: ${successCount}`);
      console.log(`   Errors: ${errorCount}`);
    } else if (needsRegeneration.length === 0) {
      console.log('\n✅ Tutti gli embedding sono già aggiornati con testo normalizzato.');
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

regenerateTaskEmbeddingsWithNormalization();
