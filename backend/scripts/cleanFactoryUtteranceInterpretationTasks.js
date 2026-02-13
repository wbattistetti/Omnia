/**
 * Script: Cancella task di tipo 3 (UtteranceInterpretation) dal database Factory
 *
 * Questo script cancella SOLO i task con type === 3 dal database factory.
 * I task "service" (come "Send SMS", "Close Call", ecc.) vengono preservati.
 *
 * Usage:
 *   node cleanFactoryUtteranceInterpretationTasks.js --dry-run    # Solo visualizza cosa verrebbe cancellato
 *   node cleanFactoryUtteranceInterpretationTasks.js --confirm    # Esegue la cancellazione
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function cleanFactoryUtteranceInterpretationTasks() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirm = args.includes('--confirm');

  if (!isDryRun && !isConfirm) {
    console.error('❌ ERRORE: Devi specificare --dry-run o --confirm');
    console.log('\nUsage:');
    console.log('  node cleanFactoryUtteranceInterpretationTasks.js --dry-run    # Solo visualizza');
    console.log('  node cleanFactoryUtteranceInterpretationTasks.js --confirm    # Esegue cancellazione');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const tasksCollection = factoryDb.collection('tasks');

    // Trova tutti i task con type === 3
    const utteranceInterpretationTasks = await tasksCollection.find({
      type: 3
    }).toArray();

    console.log(`📋 Trovati ${utteranceInterpretationTasks.length} task di tipo 3 (UtteranceInterpretation)\n`);

    if (utteranceInterpretationTasks.length === 0) {
      console.log('✅ Nessun task da cancellare. Database già pulito.');
      return;
    }

    // Mostra dettagli dei task che verranno cancellati
    console.log('📝 Task che verranno cancellati:');
    utteranceInterpretationTasks.forEach((task, index) => {
      console.log(`\n  ${index + 1}. ID: ${task._id || task.id}`);
      console.log(`     Label: ${task.label || 'N/A'}`);
      console.log(`     Type: ${task.type}`);
      console.log(`     TemplateId: ${task.templateId || 'N/A'}`);
      console.log(`     Created: ${task.createdAt ? new Date(task.createdAt).toISOString() : 'N/A'}`);
    });

    if (isDryRun) {
      console.log('\n🔍 DRY RUN: Nessuna modifica effettuata.');
      console.log('   Per eseguire la cancellazione, usa: --confirm');
      return;
    }

    if (isConfirm) {
      console.log('\n⚠️  ATTENZIONE: Stai per cancellare questi task dal database factory!');
      console.log('   Premi Ctrl+C entro 5 secondi per annullare...\n');

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Esegui la cancellazione
      const deleteResult = await tasksCollection.deleteMany({
        type: 3
      });

      console.log(`\n✅ Cancellati ${deleteResult.deletedCount} task di tipo 3 dal database factory`);

      // Verifica che siano stati cancellati
      const remaining = await tasksCollection.countDocuments({ type: 3 });
      if (remaining === 0) {
        console.log('✅ Verifica: Nessun task di tipo 3 rimasto nel database');
      } else {
        console.log(`⚠️  Attenzione: Rimangono ancora ${remaining} task di tipo 3 nel database`);
      }
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

cleanFactoryUtteranceInterpretationTasks();
