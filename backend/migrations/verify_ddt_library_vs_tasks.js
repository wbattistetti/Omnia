/**
 * Verifica se ddt_library è ridondante rispetto ai task templates
 * Confronta la struttura DDT nei task DataRequest con ddt_library
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verify() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    // ===================================
    // 1. ANALIZZA TASK DATAREQUEST
    // ===================================
    console.log('📋 Step 1: Analizza task DataRequest...\n');

    const dataRequestTasks = await db.collection('Tasks').find({ type: 3 }).toArray();
    console.log(`   DataRequest tasks: ${dataRequestTasks.length}\n`);

    let tasksWithSteps = 0;
    let tasksWithsteps = 0;
    let tasksWithDataContracts = 0;
    let tasksWithFullDDT = 0;

    for (const task of dataRequestTasks) {
      const hasSteps = task.steps && typeof task.steps === 'object' && Object.keys(task.steps).length > 0;
      const hassteps = task.steps && typeof task.steps === 'object' && Object.keys(task.steps).length > 0;
      const hasDataContracts = task.dataContracts && Array.isArray(task.dataContracts) && task.dataContracts.length > 0;

      if (hasSteps) tasksWithSteps++;
      if (hassteps) tasksWithsteps++;
      if (hasDataContracts) tasksWithDataContracts++;

      if (hasSteps && hassteps) {
        tasksWithFullDDT++;
      }
    }

    console.log(`   Con steps (root level): ${tasksWithSteps}/${dataRequestTasks.length}`);
    console.log(`   Con steps (root level): ${tasksWithsteps}/${dataRequestTasks.length}`);
    console.log(`   Con dataContracts: ${tasksWithDataContracts}/${dataRequestTasks.length}`);
    console.log(`   Con DDT completo (steps + steps): ${tasksWithFullDDT}/${dataRequestTasks.length}\n`);

    // ===================================
    // 2. ANALIZZA ddt_library
    // ===================================
    console.log('='.repeat(70));
    console.log('📋 Step 2: Analizza ddt_library...\n');

    const ddtLibrary = await db.collection('ddt_library').find({}).toArray();
    console.log(`   ddt_library totale: ${ddtLibrary.length}\n`);

    let ddtWithMainData = 0;
    let ddtWithSteps = 0;
    let ddtWithsteps = 0;
    let ddtWithFullDDT = 0;

    for (const ddt of ddtLibrary) {
      const hasMainData = ddt.ddt?.mainData && Array.isArray(ddt.ddt.mainData) && ddt.ddt.mainData.length > 0;
      const hasSteps = ddt.ddt?.steps && typeof ddt.ddt.steps === 'object' && Object.keys(ddt.ddt.steps || {}).length > 0;
      const hassteps = ddt.ddt?.steps && typeof ddt.ddt.steps === 'object' && Object.keys(ddt.ddt.steps || {}).length > 0;

      if (hasMainData) ddtWithMainData++;
      if (hasSteps) ddtWithSteps++;
      if (hassteps) ddtWithsteps++;

      if (hasMainData || (hasSteps && hassteps)) {
        ddtWithFullDDT++;
      }
    }

    console.log(`   Con mainData: ${ddtWithMainData}/${ddtLibrary.length}`);
    console.log(`   Con steps: ${ddtWithSteps}/${ddtLibrary.length}`);
    console.log(`   Con steps: ${ddtWithsteps}/${ddtLibrary.length}`);
    console.log(`   Con DDT completo: ${ddtWithFullDDT}/${ddtLibrary.length}\n`);

    // ===================================
    // 3. CONFRONTA STRUTTURE
    // ===================================
    console.log('='.repeat(70));
    console.log('📋 Step 3: Confronta strutture...\n');

    console.log('Task DataRequest (formato "flat"):');
    console.log('   - steps a root level (con escalations e tasks)');
    console.log('   - steps a root level');
    console.log('   - dataContracts a root level');
    console.log('   - NO mainData (struttura gerarchica)');
    console.log();

    console.log('ddt_library (formato "gerarchico"):');
    console.log('   - mainData con struttura gerarchica');
    console.log('   - steps dentro i nodi mainData');
    console.log('   - steps a root level o dentro nodi');
    console.log();

    // ===================================
    // 4. VERIFICA SE ddt_library È RIDONDANTE
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 CONCLUSIONI');
    console.log('='.repeat(70));

    console.log(`\n1. Task DataRequest hanno DDT: ${tasksWithFullDDT}/${dataRequestTasks.length}`);
    console.log(`   - Formato: "flat" (steps a root level)`);
    console.log(`   - Struttura: steps + steps + dataContracts`);

    console.log(`\n2. ddt_library ha DDT: ${ddtWithFullDDT}/${ddtLibrary.length}`);
    console.log(`   - Formato: "gerarchico" (mainData con steps dentro)`);
    console.log(`   - Struttura: mainData + steps + steps`);

    console.log('\n💡 ANALISI:');

    if (tasksWithFullDDT > 0 && ddtWithFullDDT === 0) {
      console.log('   ✅ Task DataRequest hanno DDT completi (formato flat)');
      console.log('   ❌ ddt_library è VUOTA (solo placeholder)');
      console.log('   💡 ddt_library è RIDONDANTE - può essere eliminata');
    } else if (tasksWithFullDDT > 0 && ddtWithFullDDT > 0) {
      console.log('   ✅ Task DataRequest hanno DDT completi');
      console.log('   ✅ ddt_library ha DDT completi');
      console.log('   ⚠️  DUE formati diversi:');
      console.log('      - Tasks: formato "flat" (steps a root level)');
      console.log('      - ddt_library: formato "gerarchico" (mainData con steps dentro)');
      console.log('   💡 Verifica se servono entrambi o se uno è legacy');
    } else if (tasksWithFullDDT === 0 && ddtWithFullDDT > 0) {
      console.log('   ❌ Task DataRequest NON hanno DDT completi');
      console.log('   ✅ ddt_library ha DDT completi');
      console.log('   💡 ddt_library serve - contiene DDT che non sono nei task templates');
    } else {
      console.log('   ❌ Né task DataRequest né ddt_library hanno DDT completi');
      console.log('   💡 Verifica se i DDT sono salvati altrove');
    }

    // Verifica scope
    if (ddtLibrary.length > 0) {
      const scopes = {};
      ddtLibrary.forEach(ddt => {
        const scope = ddt.scope || 'unknown';
        scopes[scope] = (scopes[scope] || 0) + 1;
      });
      console.log(`\n   📊 Scope in ddt_library:`);
      Object.entries(scopes).forEach(([scope, count]) => {
        console.log(`      - ${scope}: ${count} DDT`);
      });

      const hasClientScope = Object.keys(scopes).some(s => s.startsWith('client:'));
      if (hasClientScope) {
        console.log(`\n   💡 ddt_library ha DDT con scope client-specific`);
        console.log(`   💡 Questi DDT potrebbero essere separati dai task templates per scope filtering`);
        console.log(`   💡 Ma se sono vuoti (solo placeholder), non servono`);
      }
    }

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

