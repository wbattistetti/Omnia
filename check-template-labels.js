// Script per verificare le label dei template di tipo 3 nel database
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbName = 'no-client_test_1_0';

async function checkTemplateLabels() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso al database MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('tasks');

    // Cerca tutti i template di tipo 3
    const query = { type: 3 };
    const templates = await collection.find(query).toArray();

    console.log(`\n📊 Trovati ${templates.length} template di tipo 3 nel database "${dbName}"\n`);

    if (templates.length === 0) {
      console.log('⚠️ Nessun template trovato');
      return;
    }

    // Mostra le label di tutti i template
    console.log('═══════════════════════════════════════════════════════════');
    console.log('TUTTE LE LABEL DEI TEMPLATE:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const allLabels = [];
    const templatesWithSubTasks = [];

    for (const template of templates) {
      const label = template.label || '(nessuna label)';
      allLabels.push({ id: template.id || template._id, label });

      console.log(`ID: ${template.id || template._id}`);
      console.log(`Label: ${label}`);
      console.log(`Name: ${template.name || '(nessun name)'}`);

      // Se ha subTasksIds, carica anche i sub-template
      if (template.subTasksIds && template.subTasksIds.length > 0) {
        templatesWithSubTasks.push(template);
        console.log(`SubTasksIds: ${JSON.stringify(template.subTasksIds)}`);
        console.log(`\n  Sub-template:`);

        for (const subId of template.subTasksIds) {
          const subTemplate = await collection.findOne({ id: subId });
          if (subTemplate) {
            const subLabel = subTemplate.label || '(nessuna label)';
            allLabels.push({ id: subId, label: subLabel, isSub: true });
            console.log(`    - ID: ${subId}, Label: ${subLabel}`);
          } else {
            console.log(`    - ID: ${subId}, (non trovato)`);
          }
        }
      }
      console.log('───────────────────────────────────────────────────────────\n');
    }

    // Riepilogo: cerca template con label che contengono "ponte" o "altezza"
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('RIEPILOGO:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const templatesWithPonte = allLabels.filter(t =>
      t.label && t.label.toLowerCase().includes('ponte')
    );
    const templatesWithAltezza = allLabels.filter(t =>
      t.label && t.label.toLowerCase().includes('altezza')
    );

    console.log(`🔍 Template con "ponte" nella label: ${templatesWithPonte.length}`);
    if (templatesWithPonte.length > 0) {
      templatesWithPonte.forEach(t => {
        console.log(`  - ${t.id}${t.isSub ? ' (sub-template)' : ''}: "${t.label}"`);
      });
    } else {
      console.log('  ✅ Nessun template trovato con "ponte" nella label');
    }

    console.log(`\n🔍 Template con "altezza" nella label: ${templatesWithAltezza.length}`);
    if (templatesWithAltezza.length > 0) {
      templatesWithAltezza.forEach(t => {
        console.log(`  - ${t.id}${t.isSub ? ' (sub-template)' : ''}: "${t.label}"`);
      });
    } else {
      console.log('  ⚠️ Nessun template trovato con "altezza" nella label');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TUTTE LE LABEL TROVATE:');
    console.log('═══════════════════════════════════════════════════════════\n');
    allLabels.forEach(t => {
      console.log(`  "${t.label}" (ID: ${t.id}${t.isSub ? ', sub-template' : ''})`);
    });

  } catch (error) {
    console.error('❌ Errore:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

checkTemplateLabels();
