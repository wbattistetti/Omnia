// Script per arricchire le euristiche nel database
// Aggiunge pattern per MESSAGE e ProblemClassification per IT, PT, EN

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Pattern arricchiti per MESSAGE (espressioni iniziali che indicano un messaggio)
const MESSAGE_PATTERNS = {
  IT: [
    '^(saluta|salutami|salutare)',
    '^(presentati|presentarsi|presentare)',
    '^(informa|informare|informami|informare di|informare su)',
    '^(devi dire|dì|dire|dici|dica)',
    '^(comunica|comunicare|comunica che)',
    '^(annuncia|annunciare|annuncia che)',
    '^(mostra|mostrare|mostra che|mostra il)'
  ],
  PT: [
    '^(cumprimenta|cumprimentar|saúda|saudar)',
    '^(apresenta|apresentar|apresente-se)',
    '^(informa|informar|informe|informe sobre)',
    '^(deve dizer|diz|dizer|diga)',
    '^(comunica|comunicar|comunica que)',
    '^(anuncia|anunciar|anuncia que)',
    '^(mostra|mostrar|mostra que|mostra o)'
  ],
  EN: [
    '^(greet|greeting|say hello)',
    '^(introduce|introduce yourself|introduction)',
    '^(inform|inform about|information)',
    '^(say|tell|tell about|tell that)',
    '^(communicate|communicate that)',
    '^(announce|announce that)',
    '^(show|show that|show the)'
  ]
};

// Pattern arricchiti per ProblemClassification (solo per chiedere motivo/problema)
const PROBLEM_CLASSIFICATION_PATTERNS = {
  IT: [
    '^(chiedi|chiedere|chiedi il|chiedi la) (motivo|ragione|problema|causa|perché)',
    '^(domanda|domandare|domanda il|domanda la) (motivo|ragione|problema|causa)',
    '^(perché|perchè)',
    '^(qual è|qual\'è) (il|la) (motivo|ragione|problema|causa)',
    '^(individua|individuare|identifica|identificare) (il|la) (problema|motivo|ragione)'
  ],
  PT: [
    '^(pergunta|perguntar|pergunta o|pergunta a) (motivo|razão|problema|causa|por quê)',
    '^(pergunta|perguntar) por (quê|que)',
    '^(por quê|porque|por que)',
    '^(qual é|qual) (o|a) (motivo|razão|problema|causa)',
    '^(identifica|identificar|identifique) (o|a) (problema|motivo|razão)'
  ],
  EN: [
    '^(ask|asking|ask for|ask about) (the|a) (reason|problem|cause|why)',
    '^(why|what is the reason|what is the problem)',
    '^(identify|identifying|identify the) (problem|reason|cause)',
    '^(what is|what\'s) (the|a) (problem|reason|cause)'
  ]
};

async function enrichHeuristics() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbFactory);
    const collection = db.collection('Task_Types');

    // Aggiorna MESSAGE
    console.log('\n📝 Updating MESSAGE patterns...');
    const messageDoc = await collection.findOne({ _id: 'Message' });

    if (messageDoc) {
      const existingPatterns = messageDoc.patterns || {};
      const updatedPatterns = { ...existingPatterns };

      // Aggiungi pattern per ogni lingua (merge con quelli esistenti)
      ['IT', 'PT', 'EN'].forEach(lang => {
        const existing = existingPatterns[lang] || [];
        const newPatterns = MESSAGE_PATTERNS[lang] || [];
        // Merge: aggiungi solo pattern nuovi (evita duplicati)
        const merged = [...existing];
        newPatterns.forEach(pattern => {
          if (!merged.includes(pattern)) {
            merged.push(pattern);
          }
        });
        updatedPatterns[lang] = merged;
        console.log(`  ${lang}: ${existing.length} existing + ${newPatterns.length} new = ${merged.length} total`);
      });

      await collection.updateOne(
        { _id: 'Message' },
        {
          $set: {
            patterns: updatedPatterns,
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ MESSAGE patterns updated');
    } else {
      console.log('⚠️  MESSAGE document not found, creating new one...');
      await collection.insertOne({
        _id: 'Message',
        patterns: MESSAGE_PATTERNS,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ MESSAGE document created');
    }

    // Aggiorna ProblemClassification
    console.log('\n📝 Updating ProblemClassification patterns...');
    const problemDoc = await collection.findOne({ _id: 'ProblemClassification' });

    if (problemDoc) {
      const existingPatterns = problemDoc.patterns || {};
      const updatedPatterns = { ...existingPatterns };

      // Aggiungi pattern per ogni lingua (merge con quelli esistenti)
      ['IT', 'PT', 'EN'].forEach(lang => {
        const existing = existingPatterns[lang] || [];
        const newPatterns = PROBLEM_CLASSIFICATION_PATTERNS[lang] || [];
        // Merge: aggiungi solo pattern nuovi (evita duplicati)
        const merged = [...existing];
        newPatterns.forEach(pattern => {
          if (!merged.includes(pattern)) {
            merged.push(pattern);
          }
        });
        updatedPatterns[lang] = merged;
        console.log(`  ${lang}: ${existing.length} existing + ${newPatterns.length} new = ${merged.length} total`);
      });

      await collection.updateOne(
        { _id: 'ProblemClassification' },
        {
          $set: {
            patterns: updatedPatterns,
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ ProblemClassification patterns updated');
    } else {
      console.log('⚠️  ProblemClassification document not found, creating new one...');
      await collection.insertOne({
        _id: 'ProblemClassification',
        patterns: PROBLEM_CLASSIFICATION_PATTERNS,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ ProblemClassification document created');
    }

    console.log('\n✅ Heuristics enrichment completed successfully!');

  } catch (error) {
    console.error('❌ Error enriching heuristics:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Esegui lo script
if (require.main === module) {
  enrichHeuristics()
    .then(() => {
      console.log('\n✨ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { enrichHeuristics, MESSAGE_PATTERNS, PROBLEM_CLASSIFICATION_PATTERNS };

