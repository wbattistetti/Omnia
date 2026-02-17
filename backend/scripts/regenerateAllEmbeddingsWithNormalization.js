// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Script: Rigenera TUTTI gli embedding con testo normalizzato
 *
 * Questo script:
 * 1. Carica TUTTI gli embedding di tipo 'task' dal database Factory
 * 2. Per ogni embedding, normalizza il testo originale
 * 3. Rigenera l'embedding usando il testo normalizzato
 * 4. Aggiorna il database con embedding e testo normalizzato
 *
 * Usage:
 *   node regenerateAllEmbeddingsWithNormalization.js --dry-run    # Solo visualizza
 *   node regenerateAllEmbeddingsWithNormalization.js --confirm    # Esegue rigenerazione
 */

const { MongoClient } = require('mongodb');
const { normalizeTextForEmbedding } = require('../utils/embeddingTextNormalization');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';
const pythonServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';

async function regenerateAllEmbeddingsWithNormalization() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirm = args.includes('--confirm');

  if (!isDryRun && !isConfirm) {
    console.error('❌ ERRORE: Devi specificare --dry-run o --confirm');
    console.log('\nUsage:');
    console.log('  node regenerateAllEmbeddingsWithNormalization.js --dry-run    # Solo visualizza');
    console.log('  node regenerateAllEmbeddingsWithNormalization.js --confirm    # Esegue rigenerazione');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const embeddingsCollection = factoryDb.collection('embeddings');

    // Carica TUTTI gli embedding di tipo 'task'
    const embeddings = await embeddingsCollection.find({ type: 'task' }).toArray();
    console.log(`📋 Trovati ${embeddings.length} embedding di tipo 'task'\n`);

    if (embeddings.length === 0) {
      console.log('✅ Nessun embedding da processare.');
      return;
    }

    const results = [];

    for (const emb of embeddings) {
      const storedText = emb.text || '';
      const originalText = emb.originalText || storedText;

      // Normalizza il testo originale
      const normalizedText = normalizeTextForEmbedding(originalText);

      // Verifica se necessita rigenerazione
      const needsRegeneration = storedText !== normalizedText;

      results.push({
        id: emb.id,
        storedText: storedText.substring(0, 60),
        originalText: originalText.substring(0, 60),
        normalizedText: normalizedText.substring(0, 60),
        needsRegeneration
      });
    }

    const needsRegeneration = results.filter(r => r.needsRegeneration);

    console.log('📊 Riepilogo:');
    console.log(`   Total embeddings: ${results.length}`);
    console.log(`   Needs regeneration: ${needsRegeneration.length}`);
    console.log(`   Already normalized: ${results.length - needsRegeneration.length}\n`);

    if (needsRegeneration.length > 0) {
      console.log('📝 Primi 10 embedding che necessitano rigenerazione:\n');
      needsRegeneration.slice(0, 10).forEach((item, index) => {
        console.log(`  ${index + 1}. ID: ${item.id}`);
        console.log(`     Stored: "${item.storedText}"`);
        console.log(`     Original: "${item.originalText}"`);
        console.log(`     Normalized: "${item.normalizedText}"`);
        console.log('');
      });

      if (needsRegeneration.length > 10) {
        console.log(`  ... e altri ${needsRegeneration.length - 10} embedding\n`);
      }
    }

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

      for (let i = 0; i < needsRegeneration.length; i++) {
        const result = needsRegeneration[i];
        try {
          console.log(`\n[${i + 1}/${needsRegeneration.length}] Processing ${result.id}...`);

          // 1. Calcola embedding usando testo normalizzato
          const computeResponse = await fetch(`${pythonServiceUrl}/api/embeddings/compute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: result.normalizedText }),
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
            { id: result.id, type: 'task' },
            {
              $set: {
                id: result.id,
                type: 'task',
                text: result.normalizedText, // ✅ Normalized text
                originalText: result.originalText, // ✅ Original text for reference
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

          console.log(`✅ Embedding rigenerato`);
          successCount++;
        } catch (error) {
          console.error(`❌ Errore - ${error.message}`);
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

regenerateAllEmbeddingsWithNormalization();
