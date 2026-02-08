/**
 * Analizza tutti i task che potrebbero essere compositi (hanno subDataIds o label che suggeriscono dati composti)
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

// Pattern per identificare dati composti
const COMPOSITE_PATTERNS = {
  date: ['date', 'data', 'birth', 'nascita', 'dob'],
  address: ['address', 'indirizzo', 'street', 'via', 'city', 'città', 'postal', 'cap', 'zip'],
  name: ['name', 'nome', 'fullname', 'full name', 'firstname', 'lastname'],
  phone: ['phone', 'telefono', 'mobile', 'cell'],
  email: ['email', 'mail', 'e-mail']
};

function isCompositeLabel(label) {
  if (!label) return false;
  const normalized = label.toLowerCase();

  // Check date patterns
  if (COMPOSITE_PATTERNS.date.some(p => normalized.includes(p))) {
    return { type: 'date', expectedSubData: ['day', 'month', 'year', 'giorno', 'mese', 'anno'] };
  }

  // Check address patterns
  if (COMPOSITE_PATTERNS.address.some(p => normalized.includes(p))) {
    return { type: 'address', expectedSubData: ['street', 'civic', 'postal', 'city', 'country', 'via', 'civico', 'cap', 'città'] };
  }

  // Check name patterns
  if (COMPOSITE_PATTERNS.name.some(p => normalized.includes(p)) &&
      !normalized.includes('first') && !normalized.includes('last')) {
    return { type: 'name', expectedSubData: ['firstname', 'lastname', 'nome', 'cognome'] };
  }

  return false;
}

async function analyzeCompositeTasks() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const factoryDb = client.db(dbFactory);
    const collection = factoryDb.collection('Tasks');

    // Find all type: 3 tasks
    const allDataRequest = await collection.find({ type: 3 }).toArray();
    console.log(`📋 Analizzando ${allDataRequest.length} task DataRequest...\n`);

    const compositeCandidates = [];
    const tasksWithSubDataIds = [];
    const tasksWithMainDataSubData = [];

    for (const task of allDataRequest) {
      // Check if has subDataIds
      if (task.subDataIds && Array.isArray(task.subDataIds) && task.subDataIds.length > 0) {
        tasksWithSubDataIds.push(task);
      }

      // Check if has mainData with subData
      if (task.mainData && Array.isArray(task.mainData)) {
        for (const main of task.mainData) {
          if (main.subData && Array.isArray(main.subData) && main.subData.length > 0) {
            tasksWithMainDataSubData.push({
              task: task,
              mainData: main
            });
          }
        }
      }

      // Check if label suggests composite data
      const compositeInfo = isCompositeLabel(task.label);
      if (compositeInfo) {
        compositeCandidates.push({
          task: task,
          compositeType: compositeInfo.type,
          expectedSubData: compositeInfo.expectedSubData
        });
      }
    }

    console.log('='.repeat(80));
    console.log('📊 RISULTATI ANALISI');
    console.log('='.repeat(80));

    console.log(`\n1️⃣  Task con subDataIds: ${tasksWithSubDataIds.length}`);
    console.log(`2️⃣  Task con mainData.subData: ${tasksWithMainDataSubData.length}`);
    console.log(`3️⃣  Task con label che suggerisce dati composti: ${compositeCandidates.length}\n`);

    // Analyze tasks with subDataIds
    if (tasksWithSubDataIds.length > 0) {
      console.log('='.repeat(80));
      console.log('📋 TASK CON subDataIds (potenzialmente compositi)');
      console.log('='.repeat(80));

      for (const task of tasksWithSubDataIds) {
        const compositeInfo = isCompositeLabel(task.label);
        const isDate = compositeInfo && compositeInfo.type === 'date';

        console.log(`\nTask: ${task.label || 'N/A'} (${task.id})`);
        console.log(`  MainData: ${task.mainData ? 'YES' : 'NO'}`);
        console.log(`  SubDataIds count: ${task.subDataIds.length}`);
        console.log(`  SubDataIds: ${task.subDataIds.join(', ')}`);

        if (isDate) {
          console.log(`  ⚠️  DATE TYPE - Dovrebbe avere 3 sub-data (giorno, mese, anno)`);
          if (task.subDataIds.length !== 3) {
            console.log(`  ❌ PROBLEMA: Ha ${task.subDataIds.length} subDataIds invece di 3`);
          }
        }

        // Verify subDataIds exist
        const invalidIds = [];
        for (const subId of task.subDataIds) {
          if (typeof subId === 'string' && (subId === 'atomic' || subId.length < 10)) {
            invalidIds.push(subId);
          } else {
            const subTask = await collection.findOne({
              $or: [
                { id: subId },
                { _id: subId }
              ]
            });
            if (!subTask) {
              invalidIds.push(subId);
            }
          }
        }

        if (invalidIds.length > 0) {
          console.log(`  ❌ SubDataIds invalidi o non trovati: ${invalidIds.join(', ')}`);
        } else {
          console.log(`  ✅ Tutti i subDataIds sono validi`);
        }
      }
    }

    // Analyze composite candidates
    if (compositeCandidates.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('📋 TASK CON LABEL CHE SUGGERISCE DATI COMPOSTI');
      console.log('='.repeat(80));

      const byType = {};
      compositeCandidates.forEach(c => {
        if (!byType[c.compositeType]) {
          byType[c.compositeType] = [];
        }
        byType[c.compositeType].push(c);
      });

      for (const [type, candidates] of Object.entries(byType)) {
        console.log(`\n📌 Tipo: ${type.toUpperCase()} (${candidates.length} task)`);

        for (const candidate of candidates) {
          const task = candidate.task;
          const hasMainData = task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0;
          const hasSubDataIds = task.subDataIds && Array.isArray(task.subDataIds) && task.subDataIds.length > 0;
          const hasMainDataSubData = hasMainData && task.mainData.some(m => m.subData && m.subData.length > 0);

          console.log(`\n  Task: ${task.label} (${task.id})`);
          console.log(`    MainData: ${hasMainData ? 'YES' : 'NO'}`);
          console.log(`    SubDataIds: ${hasSubDataIds ? `YES (${task.subDataIds.length})` : 'NO'}`);
          console.log(`    MainData.subData: ${hasMainDataSubData ? 'YES' : 'NO'}`);
          console.log(`    Expected sub-data: ${candidate.expectedSubData.join(', ')}`);

          if (!hasMainData && !hasSubDataIds) {
            console.log(`    ⚠️  PROBLEMA: Dovrebbe essere composito ma non ha mainData né subDataIds`);
          } else if (hasSubDataIds && type === 'date' && task.subDataIds.length !== 3) {
            console.log(`    ❌ PROBLEMA: Date dovrebbe avere 3 sub-data ma ne ha ${task.subDataIds.length}`);
          }
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY PROBLEMI');
    console.log('='.repeat(80));

    const problems = [];

    // Check tasks with subDataIds but no mainData
    const withoutMainData = tasksWithSubDataIds.filter(t => !t.mainData);
    if (withoutMainData.length > 0) {
      problems.push({
        type: 'Senza mainData',
        count: withoutMainData.length,
        description: 'Task con subDataIds ma senza mainData'
      });
    }

    // Check date tasks with wrong sub-data count
    const dateTasks = tasksWithSubDataIds.filter(t => {
      const info = isCompositeLabel(t.label);
      return info && info.type === 'date' && t.subDataIds.length !== 3;
    });
    if (dateTasks.length > 0) {
      problems.push({
        type: 'Date incomplete',
        count: dateTasks.length,
        description: 'Task date con numero sbagliato di sub-data'
      });
    }

    // Check composite candidates without structure
    const compositeWithoutStructure = compositeCandidates.filter(c => {
      const t = c.task;
      return !t.mainData && (!t.subDataIds || t.subDataIds.length === 0);
    });
    if (compositeWithoutStructure.length > 0) {
      problems.push({
        type: 'Compositi senza struttura',
        count: compositeWithoutStructure.length,
        description: 'Task che dovrebbero essere compositi ma non hanno struttura'
      });
    }

    if (problems.length > 0) {
      console.log('\n⚠️  PROBLEMI TROVATI:\n');
      problems.forEach(p => {
        console.log(`  - ${p.type}: ${p.count} task`);
        console.log(`    ${p.description}`);
      });
    } else {
      console.log('\n✅ Nessun problema trovato!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

if (require.main === module) {
  analyzeCompositeTasks().catch(console.error);
}

module.exports = { analyzeCompositeTasks };
