// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Script: Verifica se gli embedding nel database hanno testo normalizzato
 *
 * Questo script:
 * 1. Carica tutti gli embedding di tipo 'task' dal database Factory
 * 2. Verifica se il testo è normalizzato o originale
 * 3. Mostra statistiche
 */

const { MongoClient } = require('mongodb');
const { normalizeTextForEmbedding } = require('../utils/embeddingTextNormalization');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function checkEmbeddingsNormalization() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const embeddingsCollection = factoryDb.collection('embeddings');

    // Carica tutti gli embedding di tipo 'task'
    const embeddings = await embeddingsCollection.find({ type: 'task' }).toArray();
    console.log(`📋 Trovati ${embeddings.length} embedding di tipo 'task'\n`);

    if (embeddings.length === 0) {
      console.log('✅ Nessun embedding trovato.');
      return;
    }

    let normalizedCount = 0;
    let originalCount = 0;
    let needsRegeneration = [];

    for (const emb of embeddings) {
      const storedText = emb.text || '';
      const originalText = emb.originalText || storedText;

      // Normalizza il testo originale per confronto
      const expectedNormalized = normalizeTextForEmbedding(originalText);

      const isNormalized = storedText === expectedNormalized;

      if (isNormalized) {
        normalizedCount++;
      } else {
        originalCount++;
        needsRegeneration.push({
          id: emb.id,
          storedText: storedText.substring(0, 60),
          originalText: originalText.substring(0, 60),
          expectedNormalized: expectedNormalized.substring(0, 60)
        });
      }
    }

    console.log('📊 Statistiche:');
    console.log(`   ✅ Normalizzati: ${normalizedCount}`);
    console.log(`   ❌ Da rigenerare: ${originalCount}`);
    console.log(`   📋 Total: ${embeddings.length}\n`);

    if (needsRegeneration.length > 0) {
      console.log('📝 Embedding che necessitano rigenerazione:\n');
      needsRegeneration.slice(0, 10).forEach((item, index) => {
        console.log(`  ${index + 1}. ID: ${item.id}`);
        console.log(`     Stored: "${item.storedText}"`);
        console.log(`     Original: "${item.originalText}"`);
        console.log(`     Expected: "${item.expectedNormalized}"`);
        console.log('');
      });

      if (needsRegeneration.length > 10) {
        console.log(`  ... e altri ${needsRegeneration.length - 10} embedding\n`);
      }
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Connessione chiusa');
  }
}

checkEmbeddingsNormalization();
