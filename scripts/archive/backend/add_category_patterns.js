/**
 * Script per aggiungere pattern deterministici per inferire categorie semantiche
 * Pattern per riconoscere automaticamente la categoria da una label
 * Es: "Chiedi il motivo della chiamata" → category: "problem-classification"
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbFactory = 'factory';

async function addCategoryPatterns() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbFactory);
    const coll = db.collection('Heuristics');

    // Pattern deterministici per italiano
    const itPatterns = [
      // problem-classification (per "motivo della chiamata")
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:il|la|lo|gli|le|l\'|un|una|uno)\\s+motivo\\s+(?:della|del|di)\\s+chiamata$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:il|la|lo|gli|le|l\'|un|una|uno)\\s+ragione\\s+(?:della|del|di)\\s+chiamata$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+per\\s+quale\\s+motivo\\s+(?:stai\\s+)?chiamando$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+per\\s+quale\\s+ragione\\s+(?:stai\\s+)?chiamando$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+il\\s+motivo\\s+per\\s+cui\\s+chiami$',
        category: 'problem-classification'
      },
      // choice
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:l\'|un\'|una)\\s+opzione\\s+(?:preferita)?$',
        category: 'choice'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:la\\s+)?scelta$',
        category: 'choice'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:la\\s+)?preferenza$',
        category: 'choice'
      },
      {
        pattern: '^(?:scegli|seleziona|preferisci)\\s+(?:tra|fra|da|dalle|dai|dagli|dalle|dall\')',
        category: 'choice'
      },
      // confirmation
      {
        pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:la\\s+)?conferma$',
        category: 'confirmation'
      },
      {
        pattern: '^(?:confermi|accetti|sei\\s+d\'accordo|conferma|accetta)$',
        category: 'confirmation'
      },
      {
        pattern: '^(?:chiedi|richiedi|domanda)\\s+(?:se\\s+)?(?:confermi|accetti|sei\\s+d\'accordo)$',
        category: 'confirmation'
      }
    ];

    // Pattern deterministici per inglese
    const enPatterns = [
      // problem-classification (per "call reason")
      {
        pattern: '^(?:ask|request|collect)\\s+(?:the\\s+)?reason\\s+(?:for|of)\\s+(?:the\\s+)?call$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:ask|request|collect)\\s+(?:the\\s+)?reason\\s+(?:for|of)\\s+(?:the\\s+)?contact$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:ask|request|collect)\\s+why\\s+(?:are\\s+you\\s+)?(?:calling|contacting)$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:ask|request|collect)\\s+(?:the\\s+)?purpose\\s+(?:of\\s+)?(?:the\\s+)?call$',
        category: 'problem-classification'
      },
      // choice
      {
        pattern: '^(?:ask|request|collect)\\s+(?:the\\s+)?preferred\\s+option$',
        category: 'choice'
      },
      {
        pattern: '^(?:ask|request|collect)\\s+(?:the\\s+)?choice$',
        category: 'choice'
      },
      {
        pattern: '^(?:choose|select|prefer)\\s+(?:from|among|between)',
        category: 'choice'
      },
      // confirmation
      {
        pattern: '^(?:ask|request)\\s+(?:for\\s+)?confirmation$',
        category: 'confirmation'
      },
      {
        pattern: '^(?:confirm|accept|agree|do\\s+you\\s+agree)$',
        category: 'confirmation'
      },
      {
        pattern: '^(?:ask|request)\\s+(?:if\\s+)?(?:you\\s+)?(?:confirm|accept|agree)$',
        category: 'confirmation'
      }
    ];

    // Pattern deterministici per portoghese
    const ptPatterns = [
      // problem-classification
      {
        pattern: '^(?:pergunte|solicite|pe[çc]a|colete)\\s+(?:o|a|os|as|um|uma)\\s+motivo\\s+(?:da|do|de)\\s+chamada$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:pergunte|solicite|pe[çc]a|colete)\\s+(?:o|a|os|as|um|uma)\\s+razão\\s+(?:da|do|de)\\s+chamada$',
        category: 'problem-classification'
      },
      {
        pattern: '^(?:pergunte|solicite|pe[çc]a|colete)\\s+por\\s+qual\\s+motivo\\s+(?:você\\s+está\\s+)?chamando$',
        category: 'problem-classification'
      },
      // choice
      {
        pattern: '^(?:pergunte|solicite|pe[çc]a|colete)\\s+(?:a|a\\s+)?op[çc][aã]o\\s+(?:preferida)?$',
        category: 'choice'
      },
      {
        pattern: '^(?:pergunte|solicite|pe[çc]a|colete)\\s+(?:a|a\\s+)?escolha$',
        category: 'choice'
      },
      {
        pattern: '^(?:escolha|selecione|prefira)\\s+(?:entre|de|das|dos|dentre)',
        category: 'choice'
      },
      // confirmation
      {
        pattern: '^(?:pergunte|solicite|pe[çc]a|colete)\\s+(?:a|a\\s+)?confirma[çc][aã]o$',
        category: 'confirmation'
      },
      {
        pattern: '^(?:confirma|aceita|concorda)$',
        category: 'confirmation'
      },
      {
        pattern: '^(?:pergunte|solicite|pe[çc]a)\\s+(?:se\\s+)?(?:você\\s+)?(?:confirma|aceita|concorda)$',
        category: 'confirmation'
      }
    ];

    const now = new Date();

    // Aggiorna o crea documento CategoryExtraction
    const result = await coll.updateOne(
      { _id: 'CategoryExtraction' },
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
          description: 'Pattern deterministici per inferire automaticamente la categoria semantica da label di task DataRequest'
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log('✅ Creato nuovo documento CategoryExtraction in Heuristics');
    } else {
      console.log('✅ Aggiornato documento CategoryExtraction esistente in Heuristics');
    }

    console.log(`✅ Pattern aggiunti:`);
    console.log(`   - IT: ${itPatterns.length} pattern`);
    console.log(`   - EN: ${enPatterns.length} pattern`);
    console.log(`   - PT: ${ptPatterns.length} pattern`);

    // Verifica che sia stato salvato correttamente
    const saved = await coll.findOne({ _id: 'CategoryExtraction' });
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
  addCategoryPatterns()
    .then(() => {
      console.log('✅ Script completato con successo');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { addCategoryPatterns };
