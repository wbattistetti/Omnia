/**
 * Script per aggiungere pattern deterministici per estrazione mainData
 * Pattern per riconoscere e estrarre automaticamente il nome del dato da frasi comuni
 * Es: "Chiedi il motivo della chiamata" → mainData: "motivo della chiamata"
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbFactory = 'factory';

async function addDataNameExtractionPatterns() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Heuristics');

    // Pattern deterministici per italiano
    const itPatterns = [
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:il|la|lo|gli|le|l\'|un|una|uno)\\s+motivo\\s+(?:della|del|di)\\s+chiamata$',
        mainDataName: 'motivo della chiamata',
        kind: 'generic'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:il|la|lo|gli|le|l\'|un|una|uno)\\s+ragione\\s+(?:della|del|di)\\s+chiamata$',
        mainDataName: 'motivo della chiamata',
        kind: 'generic'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+per\\s+quale\\s+motivo\\s+(?:stai\\s+)?chiamando$',
        mainDataName: 'motivo della chiamata',
        kind: 'generic'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+per\\s+quale\\s+ragione\\s+(?:stai\\s+)?chiamando$',
        mainDataName: 'motivo della chiamata',
        kind: 'generic'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+il\\s+motivo\\s+per\\s+cui\\s+chiami$',
        mainDataName: 'motivo della chiamata',
        kind: 'generic'
      }
    ];

    // Pattern deterministici per inglese
    const enPatterns = [
      {
        pattern: '^(?:ask|asks|request|requests|collect|collects)\\s+(?:for\\s+)?(?:the\\s+)?reason\\s+(?:for|of)\\s+(?:the\\s+)?call$',
        mainDataName: 'call reason',
        kind: 'generic'
      },
      {
        pattern: '^(?:ask|asks|request|requests|collect|collects)\\s+(?:for\\s+)?(?:the\\s+)?reason\\s+(?:for|of)\\s+(?:the\\s+)?contact$',
        mainDataName: 'contact reason',
        kind: 'generic'
      },
      {
        pattern: '^(?:ask|asks|request|requests|collect|collects)\\s+why\\s+(?:are\\s+you\\s+)?(?:calling|contacting)$',
        mainDataName: 'call reason',
        kind: 'generic'
      },
      {
        pattern: '^(?:ask|asks|request|requests|collect|collects)\\s+(?:for\\s+)?(?:the\\s+)?purpose\\s+(?:of\\s+)?(?:the\\s+)?call$',
        mainDataName: 'call purpose',
        kind: 'generic'
      }
    ];

    // Pattern deterministici per portoghese
    const ptPatterns = [
      {
        pattern: '^(?:peça|solicite|pergunte|colete)\\s+(?:o|a|os|as|um|uma)\\s+motivo\\s+(?:da|do|de)\\s+chamada$',
        mainDataName: 'motivo da chamada',
        kind: 'generic'
      },
      {
        pattern: '^(?:peça|solicite|pergunte|colete)\\s+(?:o|a|os|as|um|uma)\\s+razão\\s+(?:da|do|de)\\s+chamada$',
        mainDataName: 'motivo da chamada',
        kind: 'generic'
      },
      {
        pattern: '^(?:peça|solicite|pergunte|colete)\\s+por\\s+qual\\s+motivo\\s+(?:você\\s+está\\s+)?chamando$',
        mainDataName: 'motivo da chamada',
        kind: 'generic'
      }
    ];

    const now = new Date();

    // Aggiorna o crea documento DataNameExtraction
    const result = await coll.updateOne(
      { _id: 'DataNameExtraction' },
      {
        $set: {
          patterns: {
            IT: itPatterns,
            EN: enPatterns,
            PT: ptPatterns
          },
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now,
          description: 'Pattern deterministici per estrazione automatica del nome del mainData da label di task DataRequest'
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log('✅ Creato nuovo documento DataNameExtraction in Heuristics');
    } else {
      console.log('✅ Aggiornato documento DataNameExtraction esistente in Heuristics');
    }

    console.log(`✅ Pattern aggiunti:`);
    console.log(`   - IT: ${itPatterns.length} pattern`);
    console.log(`   - EN: ${enPatterns.length} pattern`);
    console.log(`   - PT: ${ptPatterns.length} pattern`);

    // Verifica che sia stato salvato correttamente
    const saved = await coll.findOne({ _id: 'DataNameExtraction' });
    if (saved) {
      console.log('✅ Verifica: documento salvato correttamente');
      console.log(`   - IT patterns: ${saved.patterns?.IT?.length || 0}`);
      console.log(`   - EN patterns: ${saved.patterns?.EN?.length || 0}`);
      console.log(`   - PT patterns: ${saved.patterns?.PT?.length || 0}`);
    } else {
      console.error('❌ Errore: documento non trovato dopo il salvataggio');
    }

  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta dei pattern:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Esegui lo script
if (require.main === module) {
  addDataNameExtractionPatterns()
    .then(() => {
      console.log('✅ Script completato con successo');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { addDataNameExtractionPatterns };
