/**
 * Script: Verifica il template Date e i suoi sub-template
 *
 * Verifica:
 * - Se il template "Date" esiste
 * - Se ha subTasksIds configurati
 * - Se i template Day, Month, Year esistono
 * - Se i subTasksIds puntano ai template corretti
 * - Se i sub-template hanno la struttura corretta
 *
 * Esegui con: node backend/migrations/verify_date_template.js
 * (Solo lettura, nessuna modifica)
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Template ID noto del Date (dal log)
const DATE_TEMPLATE_ID = '723a1aa9-a904-4b55-82f3-a501dfbe0351';

async function verifyDateTemplate() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(70));
    console.log('VERIFICA TEMPLATE DATE');
    console.log('='.repeat(70));
    console.log('');

    const db = client.db(dbFactory);
    const tasksCollection = db.collection('tasks');

    // ===================================
    // 1. TROVA IL TEMPLATE DATE
    // ===================================
    console.log('🔍 Step 1: Cercando template Date...\n');

    // Prova prima per id field
    let dateTemplate = await tasksCollection.findOne({ id: DATE_TEMPLATE_ID });

    // Se non trovato, cerca per label
    if (!dateTemplate) {
      console.log(`   ⚠️  Non trovato per id: ${DATE_TEMPLATE_ID}`);
      console.log('   🔍 Cercando per label...');
      dateTemplate = await tasksCollection.findOne({
        $or: [
          { label: 'Date' },
          { label: 'date' },
          { name: 'Date' },
          { name: 'date' }
        ],
        templateId: null // Solo template, non istanze
      });
    }

    if (!dateTemplate) {
      console.log('   ❌ Template Date NON trovato nel database factory');
      console.log('   Cercato per id:', DATE_TEMPLATE_ID);
      console.log('   Cercato per label: Date, date\n');
      return;
    }

    console.log('   ✅ Template Date trovato:');
    console.log(`      ID: ${dateTemplate.id || dateTemplate._id}`);
    console.log(`      Label: ${dateTemplate.label || dateTemplate.name || 'N/A'}`);
    console.log(`      Type: ${dateTemplate.type || 'N/A'}`);
    console.log(`      TemplateId: ${dateTemplate.templateId}`);
    console.log(`      SubTasksIds: ${JSON.stringify(dateTemplate.subTasksIds || [])}`);
    console.log(`      SubTasksIds length: ${(dateTemplate.subTasksIds || []).length}`);
    console.log(`      Has subTasksIds: ${!!dateTemplate.subTasksIds && dateTemplate.subTasksIds.length > 0}\n`);

    // ===================================
    // 2. VERIFICA SUB-TEMPLATE
    // ===================================
    console.log('🔍 Step 2: Cercando sub-template (Day, Month, Year)...\n');

    const subTemplateIds = {};
    const subTemplates = {};

    const expectedLabels = {
      day: ['day', 'giorno', 'Day', 'Giorno'],
      month: ['month', 'mese', 'Month', 'Mese'],
      year: ['year', 'anno', 'Year', 'Anno']
    };

    for (const [key, labels] of Object.entries(expectedLabels)) {
      // Cerca per label esatta (case insensitive)
      const found = await tasksCollection.findOne({
        $or: [
          { label: { $in: labels } },
          { name: { $in: labels } }
        ],
        templateId: null // Solo template
      });

      if (found) {
        subTemplates[key] = found;
        subTemplateIds[key] = found.id || found._id?.toString();
        console.log(`   ✅ ${key.toUpperCase()} trovato:`);
        console.log(`      ID: ${subTemplateIds[key]}`);
        console.log(`      Label: ${found.label || found.name || 'N/A'}`);
        console.log(`      Type: ${found.type || 'N/A'}`);
        console.log(`      TemplateId: ${found.templateId}`);
        console.log(`      SubTasksIds: ${JSON.stringify(found.subTasksIds || [])}`);
      } else {
        console.log(`   ❌ ${key.toUpperCase()} NON trovato`);
        console.log(`      Cercato per label: ${labels.join(', ')}`);
      }
      console.log('');
    }

    // ===================================
    // 3. VERIFICA CORRISPONDENZA
    // ===================================
    console.log('🔍 Step 3: Verificando corrispondenza subTasksIds...\n');

    const currentSubTasksIds = dateTemplate.subTasksIds || [];
    const expectedSubTasksIds = Object.values(subTemplateIds).filter(Boolean);

    console.log(`   SubTasksIds nel template Date: ${JSON.stringify(currentSubTasksIds)}`);
    console.log(`   SubTasksIds attesi (Day, Month, Year): ${JSON.stringify(expectedSubTasksIds)}\n`);

    if (currentSubTasksIds.length === 0) {
      console.log('   ❌ PROBLEMA: Template Date NON ha subTasksIds configurati');
      console.log('   ⚠️  Il template dovrebbe avere subTasksIds con i GUID di Day, Month, Year\n');
    } else if (currentSubTasksIds.length !== expectedSubTasksIds.length) {
      console.log(`   ⚠️  ATTENZIONE: Numero di subTasksIds non corrisponde`);
      console.log(`      Attuali: ${currentSubTasksIds.length}, Attesi: ${expectedSubTasksIds.length}\n`);
    } else {
      // Verifica se tutti i subTasksIds corrispondono
      const allMatch = expectedSubTasksIds.every(id => currentSubTasksIds.includes(id));
      const allPresent = currentSubTasksIds.every(id => expectedSubTasksIds.includes(id));

      if (allMatch && allPresent) {
        console.log('   ✅ OK: Tutti i subTasksIds corrispondono correttamente\n');
      } else {
        console.log('   ⚠️  ATTENZIONE: Alcuni subTasksIds non corrispondono');
        const missing = expectedSubTasksIds.filter(id => !currentSubTasksIds.includes(id));
        const extra = currentSubTasksIds.filter(id => !expectedSubTasksIds.includes(id));
        if (missing.length > 0) {
          console.log(`      Mancanti: ${JSON.stringify(missing)}`);
        }
        if (extra.length > 0) {
          console.log(`      Extra: ${JSON.stringify(extra)}`);
        }
        console.log('');
      }
    }

    // ===================================
    // 4. VERIFICA STRUTTURA COMPLETA
    // ===================================
    console.log('🔍 Step 4: Verificando struttura completa...\n');

    if (currentSubTasksIds.length > 0) {
      console.log('   Verificando che ogni subTasksId punti a un template esistente:\n');

      for (const subId of currentSubTasksIds) {
        const subTemplate = await tasksCollection.findOne({
          $or: [
            { id: subId },
            { _id: typeof subId === 'string' && /^[0-9a-fA-F]{24}$/.test(subId) ? new ObjectId(subId) : subId }
          ]
        });

        if (subTemplate) {
          const label = subTemplate.label || subTemplate.name || 'N/A';
          const isTemplate = subTemplate.templateId === null || subTemplate.templateId === subTemplate.id;
          console.log(`   ✅ ${subId}: ${label} (${isTemplate ? 'template' : 'istanza'})`);
        } else {
          console.log(`   ❌ ${subId}: NON trovato nel database`);
        }
      }
      console.log('');
    }

    // ===================================
    // 5. RIEPILOGO
    // ===================================
    console.log('='.repeat(70));
    console.log('RIEPILOGO');
    console.log('='.repeat(70));
    console.log('');

    const issues = [];

    if (!dateTemplate) {
      issues.push('❌ Template Date non trovato');
    } else {
      if (!dateTemplate.subTasksIds || dateTemplate.subTasksIds.length === 0) {
        issues.push('❌ Template Date non ha subTasksIds configurati');
      }

      const missingSubs = Object.entries(subTemplateIds)
        .filter(([key, id]) => !id)
        .map(([key]) => key.toUpperCase());

      if (missingSubs.length > 0) {
        issues.push(`❌ Sub-template mancanti: ${missingSubs.join(', ')}`);
      }

      if (currentSubTasksIds.length > 0 && expectedSubTasksIds.length > 0) {
        const missingIds = expectedSubTasksIds.filter(id => !currentSubTasksIds.includes(id));
        if (missingIds.length > 0) {
          issues.push(`⚠️  SubTasksIds mancanti nel Date: ${JSON.stringify(missingIds)}`);
        }
      }
    }

    if (issues.length === 0) {
      console.log('✅ TUTTO OK: Il template Date è configurato correttamente');
      console.log(`   - Template Date trovato: ${dateTemplate.id || dateTemplate._id}`);
      console.log(`   - SubTasksIds configurati: ${currentSubTasksIds.length}`);
      console.log(`   - Sub-template trovati: ${Object.keys(subTemplates).length}/3`);
    } else {
      console.log('⚠️  PROBLEMI TROVATI:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }

    console.log('');

  } catch (error) {
    console.error('❌ Errore:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('🔌 Disconnesso da MongoDB');
  }
}

// Esegui
verifyDateTemplate().catch(console.error);
