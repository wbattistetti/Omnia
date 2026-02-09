/**
 * Script: Verifica utilizzo collections obsolete
 *
 * Verifica:
 * 1. Se task elementari (email, phone, date, number) sono in Tasks con nlpContract
 * 2. Se factory_types è ancora usata o legacy
 * 3. Se BackendCalls è duplicata con Tasks type: 4
 * 4. Se loadDDTLibrary è chiamato nel frontend
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verify() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🔍 VERIFICA UTILIZZO COLLECTIONS');
    console.log('='.repeat(80));
    console.log();

    const db = client.db(dbFactory);

    // 1. VERIFICA: Task elementari in Tasks con nlpContract
    console.log('📋 1. VERIFICA: Task elementari in Tasks con nlpContract');
    console.log('-'.repeat(80));

    const elementariNames = ['email', 'phone', 'date', 'number', 'text', 'name'];
    const tasks = await db.collection('Tasks').find({
      type: 3, // DataRequest
      $or: [
        { name: { $in: elementariNames } },
        { label: { $regex: new RegExp(`^(${elementariNames.join('|')})$`, 'i') } }
      ]
    }).toArray();

    console.log(`   Trovati ${tasks.length} task elementari in Tasks:`);
    tasks.forEach(t => {
      const hasNlpContract = !!(t.nlpContract || (t.mainData && t.mainData[0]?.nlpContract));
      console.log(`   - ${t.name || t.label || t.id}: ${hasNlpContract ? '✅ ha nlpContract' : '❌ NO nlpContract'}`);
    });

    // 2. VERIFICA: factory_types
    console.log('\n📋 2. VERIFICA: factory_types');
    console.log('-'.repeat(80));

    const factoryTypes = await db.collection('factory_types').find({}).toArray();
    console.log(`   factory_types: ${factoryTypes.length} documenti`);

    if (factoryTypes.length > 0) {
      console.log('   Documenti:');
      factoryTypes.forEach(ft => {
        console.log(`   - ${ft.name || ft.id}: ${ft.extractorCode ? '✅ ha extractorCode' : '❌ NO extractorCode'}`);
      });

      // Confronta con Tasks
      const factoryTypeNames = factoryTypes.map(ft => ft.name || ft.id).filter(Boolean);
      const tasksWithSameNames = await db.collection('Tasks').find({
        type: 3,
        $or: [
          { name: { $in: factoryTypeNames } },
          { label: { $regex: new RegExp(`^(${factoryTypeNames.join('|')})$`, 'i') } }
        ]
      }).toArray();

      console.log(`\n   Confronto con Tasks: ${tasksWithSameNames.length} task con stesso nome`);
      if (tasksWithSameNames.length === factoryTypes.length) {
        console.log('   💡 factory_types potrebbe essere RIDONDANTE (tutti i task sono già in Tasks)');
      } else if (tasksWithSameNames.length > 0) {
        console.log('   ⚠️  Parziale sovrapposizione - alcuni task sono in Tasks, altri no');
      } else {
        console.log('   ✅ factory_types NON è ridondante (task non sono in Tasks)');
      }
    } else {
      console.log('   ✅ factory_types è VUOTA - può essere eliminata');
    }

    // 3. VERIFICA: BackendCalls vs Tasks type: 4
    console.log('\n📋 3. VERIFICA: BackendCalls vs Tasks type: 4');
    console.log('-'.repeat(80));

    const backendCalls = await db.collection('BackendCalls').find({}).toArray();
    const tasksBackendCall = await db.collection('Tasks').find({ type: 4 }).toArray();

    console.log(`   BackendCalls: ${backendCalls.length} documenti`);
    console.log(`   Tasks type: 4 (BackendCall): ${tasksBackendCall.length} documenti`);

    if (backendCalls.length > 0 && tasksBackendCall.length > 0) {
      // Confronta ID/label
      const backendCallsIds = new Set(backendCalls.map(bc => bc.id || bc._id?.toString()).filter(Boolean));
      const backendCallsLabels = new Set(backendCalls.map(bc => bc.label || bc.name).filter(Boolean));

      const tasksIds = new Set(tasksBackendCall.map(t => t.id || t._id?.toString()).filter(Boolean));
      const tasksLabels = new Set(tasksBackendCall.map(t => t.label || t.name).filter(Boolean));

      const commonIds = [...backendCallsIds].filter(id => tasksIds.has(id));
      const commonLabels = [...backendCallsLabels].filter(label => tasksLabels.has(label));

      console.log(`   ID comuni: ${commonIds.length}`);
      console.log(`   Label comuni: ${commonLabels.length}`);

      if (commonIds.length > 0 || commonLabels.length > 0) {
        console.log('   💡 BackendCalls è PARZIALMENTE duplicata con Tasks');
      } else {
        console.log('   ✅ BackendCalls NON è duplicata (dati diversi)');
      }
    } else if (backendCalls.length === 0) {
      console.log('   ✅ BackendCalls è VUOTA - può essere eliminata');
    } else if (tasksBackendCall.length === 0) {
      console.log('   ⚠️  Tasks type: 4 è VUOTA - BackendCalls potrebbe essere legacy');
    }

    // 4. VERIFICA: ddt_library
    console.log('\n📋 4. VERIFICA: ddt_library');
    console.log('-'.repeat(80));

    const ddtLibrary = await db.collection('ddt_library').find({}).toArray();
    console.log(`   ddt_library: ${ddtLibrary.length} documenti`);

    if (ddtLibrary.length > 0) {
      let emptyCount = 0;
      let withDDTCount = 0;

      ddtLibrary.forEach(ddt => {
        const hasMainData = !!(ddt.ddt?.mainData && ddt.ddt.mainData.length > 0);
        const hasSteps = !!(ddt.ddt?.steps && Object.keys(ddt.ddt.steps).length > 0);

        if (hasMainData || hasSteps) {
          withDDTCount++;
        } else {
          emptyCount++;
        }
      });

      console.log(`   Documenti con DDT completo: ${withDDTCount}`);
      console.log(`   Documenti vuoti (placeholder): ${emptyCount}`);

      if (emptyCount === ddtLibrary.length) {
        console.log('   ✅ ddt_library è VUOTA (tutti placeholder) - può essere eliminata');
      } else if (withDDTCount > 0) {
        console.log('   ⚠️  ddt_library ha DDT completi - verificare se sono già in Tasks');
      }
    } else {
      console.log('   ✅ ddt_library è VUOTA - può essere eliminata');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Verifica completata');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  verify().catch(console.error);
}

module.exports = { verify };

