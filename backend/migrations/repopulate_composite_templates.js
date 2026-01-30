/**
 * Script: Ripopola subTasksIds per tutti i template compositi
 *
 * Identifica template compositi che:
 * - Hanno dataContract con subDataMapping (indica che sono compositi)
 * - Hanno label che suggeriscono compositi (Date, Name, Address, ecc.)
 * - Ma hanno subTasksIds vuoti o mancanti
 *
 * Per ogni template composito:
 * 1. Cerca i sub-template usando subDataMapping o label
 * 2. Aggiorna subTasksIds con i GUID corretti
 *
 * Esegui con: node backend/migrations/repopulate_composite_templates.js
 * Per confermare e applicare: node backend/migrations/repopulate_composite_templates.js --confirm
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Mapping noti per template compositi comuni
const COMPOSITE_MAPPINGS = {
  // Date → Day, Month, Year
  date: {
    labels: ['date', 'data', 'Date', 'Data'],
    expectedSubs: [
      { labels: ['day', 'giorno', 'Day', 'Giorno'], canonicalKey: 'day' },
      { labels: ['month', 'mese', 'Month', 'Mese'], canonicalKey: 'month' },
      { labels: ['year', 'anno', 'Year', 'Anno'], canonicalKey: 'year' }
    ]
  },
  // Name → FirstName, LastName
  name: {
    labels: ['name', 'nome', 'Name', 'Nome', 'fullname', 'full name', 'FullName'],
    expectedSubs: [
      { labels: ['firstname', 'first name', 'nome', 'FirstName', 'Nome'], canonicalKey: 'firstname' },
      { labels: ['lastname', 'last name', 'cognome', 'LastName', 'Cognome'], canonicalKey: 'lastname' }
    ]
  },
  // Address → Street, City, Postal, ecc.
  address: {
    labels: ['address', 'indirizzo', 'Address', 'Indirizzo'],
    expectedSubs: [
      { labels: ['street', 'via', 'Street', 'Via'], canonicalKey: 'street' },
      { labels: ['city', 'città', 'City', 'Città'], canonicalKey: 'city' },
      { labels: ['postal', 'cap', 'zip', 'Postal', 'CAP', 'Zip'], canonicalKey: 'postal' }
    ]
  }
};

async function repopulateCompositeTemplates() {
  const client = new MongoClient(uri);
  const isConfirm = process.argv.includes('--confirm');

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(70));
    console.log('RIPOPOLAZIONE SUBTASKSIDS PER TEMPLATE COMPOSITI');
    console.log('='.repeat(70));
    console.log('');

    const db = client.db(dbFactory);
    const tasksCollection = db.collection('tasks');

    // ===================================
    // 1. TROVA TUTTI I TEMPLATE COMPOSITI
    // ===================================
    console.log('🔍 Step 1: Cercando template compositi...\n');

    // Criteri per identificare template compositi:
    // 1. Hanno dataContract.subDataMapping (indica composito)
    // 2. Hanno label che suggeriscono compositi
    // 3. Sono template (templateId === null)
    const compositeCandidates = await tasksCollection.find({
      templateId: null, // Solo template
      $or: [
        { 'dataContract.subDataMapping': { $exists: true, $ne: {} } },
        { label: { $in: ['Date', 'date', 'Name', 'name', 'Address', 'address'] } }
      ]
    }).toArray();

    console.log(`   Trovati ${compositeCandidates.length} template candidati compositi\n`);

    if (compositeCandidates.length === 0) {
      console.log('   ⚠️  Nessun template composito trovato\n');
      return;
    }

    // ===================================
    // 2. PER OGNI TEMPLATE, IDENTIFICA SUB-TEMPLATE
    // ===================================
    console.log('🔍 Step 2: Identificando sub-template per ogni template composito...\n');

    const updates = [];
    let foundCount = 0;
    let fixedCount = 0;
    let skippedCount = 0;

    for (const template of compositeCandidates) {
      const templateId = template.id || template._id?.toString();
      const label = (template.label || template.name || '').toLowerCase();
      const currentSubTasksIds = template.subTasksIds || [];
      const subDataMapping = template.dataContract?.subDataMapping || {};

      console.log(`\n📋 Template: ${template.label || template.name || templateId}`);
      console.log(`   ID: ${templateId}`);
      console.log(`   SubTasksIds attuali: ${JSON.stringify(currentSubTasksIds)}`);
      console.log(`   SubDataMapping keys: ${Object.keys(subDataMapping).length}`);

      // Strategia 1: Usa subDataMapping se presente
      let expectedSubIds = [];
      let strategy = '';

      if (Object.keys(subDataMapping).length > 0) {
        // ✅ Usa subDataMapping: le chiavi sono i subId (templateId dei sub-template)
        strategy = 'subDataMapping';
        expectedSubIds = Object.keys(subDataMapping);
        console.log(`   ✅ Strategia: subDataMapping → ${expectedSubIds.length} sub-template trovati`);
      } else {
        // Strategia 2: Usa mapping noti per label comuni
        for (const [key, mapping] of Object.entries(COMPOSITE_MAPPINGS)) {
          if (mapping.labels.some(l => label.includes(l.toLowerCase()))) {
            strategy = `mapping-${key}`;
            console.log(`   ✅ Strategia: mapping-${key} per label "${label}"`);

            // Cerca ogni sub-template per label
            for (const subSpec of mapping.expectedSubs) {
              const subTemplate = await tasksCollection.findOne({
                $or: subSpec.labels.map(l => ({ label: new RegExp(`^${l}$`, 'i') })),
                templateId: null
              });

              if (subTemplate) {
                const subId = subTemplate.id || subTemplate._id?.toString();
                expectedSubIds.push(subId);
                console.log(`      ✅ ${subSpec.canonicalKey}: ${subId}`);
              } else {
                console.log(`      ❌ ${subSpec.canonicalKey}: NON trovato`);
              }
            }
            break;
          }
        }
      }

      // Verifica se i sub-template esistono
      const verifiedSubIds = [];
      for (const subId of expectedSubIds) {
        const subTemplate = await tasksCollection.findOne({
          $or: [
            { id: subId },
            { _id: typeof subId === 'string' && /^[0-9a-fA-F]{24}$/.test(subId) ? new ObjectId(subId) : subId }
          ]
        });

        if (subTemplate) {
          verifiedSubIds.push(subId);
        } else {
          console.log(`      ⚠️  SubId ${subId} non trovato nel database`);
        }
      }

      // Confronta con subTasksIds attuali
      const needsUpdate =
        verifiedSubIds.length > 0 && (
          currentSubTasksIds.length === 0 ||
          currentSubTasksIds.length !== verifiedSubIds.length ||
          !verifiedSubIds.every(id => currentSubTasksIds.includes(id))
        );

      if (needsUpdate) {
        foundCount++;
        console.log(`   ⚠️  AGGIORNAMENTO NECESSARIO`);
        console.log(`      Attuali: ${JSON.stringify(currentSubTasksIds)}`);
        console.log(`      Attesi: ${JSON.stringify(verifiedSubIds)}`);

        if (isConfirm) {
          await tasksCollection.updateOne(
            { _id: template._id },
            { $set: { subTasksIds: verifiedSubIds, updatedAt: new Date() } }
          );
          fixedCount++;
          console.log(`      ✅ AGGIORNATO`);
        } else {
          updates.push({
            templateId,
            label: template.label || template.name,
            current: currentSubTasksIds,
            expected: verifiedSubIds,
            strategy
          });
          console.log(`      ⏸️  In attesa di conferma (--confirm)`);
        }
      } else if (verifiedSubIds.length > 0) {
        skippedCount++;
        console.log(`   ✅ Già configurato correttamente`);
      } else {
        skippedCount++;
        console.log(`   ⚠️  Nessun sub-template trovato (template atomico?)`);
      }
    }

    // ===================================
    // 3. RIEPILOGO
    // ===================================
    console.log('\n' + '='.repeat(70));
    console.log('RIEPILOGO');
    console.log('='.repeat(70));
    console.log('');

    if (!isConfirm) {
      console.log('⚠️  MODALITÀ DRY-RUN (nessuna modifica applicata)');
      console.log(`   Template da aggiornare: ${updates.length}\n`);

      if (updates.length > 0) {
        console.log('📋 Template che verranno aggiornati:\n');
        updates.forEach((u, idx) => {
          console.log(`${idx + 1}. ${u.label} (${u.templateId})`);
          console.log(`   Strategia: ${u.strategy}`);
          console.log(`   Attuali: ${JSON.stringify(u.current)}`);
          console.log(`   Attesi: ${JSON.stringify(u.expected)}\n`);
        });

        console.log('\n💡 Per applicare le modifiche, esegui:');
        console.log('   node backend/migrations/repopulate_composite_templates.js --confirm\n');
      }
    } else {
      console.log(`✅ Template analizzati: ${compositeCandidates.length}`);
      console.log(`✅ Template aggiornati: ${fixedCount}`);
      console.log(`⏭️  Template già corretti: ${skippedCount}`);
      console.log(`\n✅ Ripopolazione completata!\n`);
    }

  } catch (error) {
    console.error('❌ Errore:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('🔌 Disconnesso da MongoDB');
  }
}

// Esegui
repopulateCompositeTemplates().catch(console.error);
