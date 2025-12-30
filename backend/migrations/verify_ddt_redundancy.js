/**
 * Verifica se ddt_library è ridondante perché i task templates hanno già DDT
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
    // 1. ANALIZZA Tasks - Verifica se hanno DDT
    // ===================================
    console.log('📋 Step 1: Analizza Tasks - Verifica se hanno DDT...\n');

    const tasks = await db.collection('Tasks').find({}).toArray();
    console.log(`   Tasks totali: ${tasks.length}\n`);

    let tasksWithMainData = 0;
    let tasksWithSteps = 0;
    let tasksWithStepPrompts = 0;
    let tasksWithFullDDT = 0;

    const tasksWithDDT = [];

    for (const task of tasks) {
      let hasMainData = false;
      let hasSteps = false;
      let hasStepPrompts = false;

      // Verifica mainData
      if (task.mainData && Array.isArray(task.mainData) && task.mainData.length > 0) {
        hasMainData = true;
        tasksWithMainData++;

        // Verifica se mainData ha steps dentro i nodi
        for (const node of task.mainData) {
          if (node.steps && (Array.isArray(node.steps) || Object.keys(node.steps || {}).length > 0)) {
            hasSteps = true;
            tasksWithSteps++;
            break; // Basta un nodo con steps
          }
        }
      }

      // Verifica stepPrompts a root level
      if (task.stepPrompts && Object.keys(task.stepPrompts || {}).length > 0) {
        hasStepPrompts = true;
        tasksWithStepPrompts++;
      }

      // Task con DDT completo
      if (hasMainData && (hasSteps || hasStepPrompts)) {
        tasksWithFullDDT++;
        tasksWithDDT.push({
          id: task.id,
          label: task.label,
          mainDataCount: task.mainData?.length || 0,
          hasSteps: hasSteps,
          hasStepPrompts: hasStepPrompts
        });
      }
    }

    console.log(`   Tasks con mainData: ${tasksWithMainData}`);
    console.log(`   Tasks con steps (dentro mainData): ${tasksWithSteps}`);
    console.log(`   Tasks con stepPrompts (root level): ${tasksWithStepPrompts}`);
    console.log(`   Tasks con DDT completo: ${tasksWithFullDDT}\n`);

    if (tasksWithDDT.length > 0) {
      console.log('   Esempi Tasks con DDT:');
      tasksWithDDT.slice(0, 5).forEach(t => {
        console.log(`      - ${t.id}: ${t.label}`);
        console.log(`        mainData: ${t.mainDataCount} nodi, steps: ${t.hasSteps}, stepPrompts: ${t.hasStepPrompts}`);
      });
      console.log();
    }

    // ===================================
    // 2. ANALIZZA ddt_library
    // ===================================
    console.log('='.repeat(70));
    console.log('📋 Step 2: Analizza ddt_library...\n');

    const ddtLibrary = await db.collection('ddt_library').find({}).toArray();
    console.log(`   ddt_library totale: ${ddtLibrary.length}\n`);

    let ddtWithMainData = 0;
    let ddtWithSteps = 0;
    let ddtWithComposition = 0;

    for (const ddt of ddtLibrary) {
      if (ddt.ddt?.mainData && Array.isArray(ddt.ddt.mainData) && ddt.ddt.mainData.length > 0) {
        ddtWithMainData++;
      }
      if (ddt.ddt?.steps && (Array.isArray(ddt.ddt.steps) || Object.keys(ddt.ddt.steps || {}).length > 0)) {
        ddtWithSteps++;
      }
      if (ddt.composition) {
        ddtWithComposition++;
      }
    }

    console.log(`   DDT con mainData: ${ddtWithMainData}`);
    console.log(`   DDT con steps: ${ddtWithSteps}`);
    console.log(`   DDT con composition (compositi): ${ddtWithComposition}\n`);

    if (ddtLibrary.length > 0) {
      console.log('   Esempi ddt_library:');
      ddtLibrary.slice(0, 3).forEach(ddt => {
        console.log(`      - ${ddt.id}: ${ddt.label || 'N/A'}`);
        console.log(`        scope: ${ddt.scope || 'N/A'}`);
        console.log(`        mainData: ${ddt.ddt?.mainData?.length || 0} nodi`);
        console.log(`        steps: ${ddt.ddt?.steps ? 'Sì' : 'No'}`);
        console.log(`        composition: ${ddt.composition ? 'Sì' : 'No'}`);
        console.log(`        migration source: ${ddt._migrationSource || 'N/A'}`);
      });
      console.log();
    }

    // ===================================
    // 3. CONFRONTA - Verifica duplicati
    // ===================================
    console.log('='.repeat(70));
    console.log('📋 Step 3: Confronta Tasks vs ddt_library...\n');

    // Verifica se ddt_library contiene DDT che sono già nei Tasks
    const taskIds = new Set(tasks.map(t => t.id || t._id?.toString()));
    const ddtIds = new Set(ddtLibrary.map(d => d.id || d._id?.toString()));

    const duplicateIds = [...taskIds].filter(id => ddtIds.has(id));
    const ddtIdsStartingWithDDT = [...ddtIds].filter(id => id && id.startsWith('ddt_'));

    // Verifica anche se ddt_library ha ID che corrispondono a task IDs (con prefisso ddt_)
    const ddtIdsMatchingTasks = [];
    for (const ddtId of ddtIds) {
      if (ddtId && ddtId.startsWith('ddt_')) {
        const taskId = ddtId.replace(/^ddt_/, '');
        if (taskIds.has(taskId)) {
          ddtIdsMatchingTasks.push({ ddtId, taskId });
        }
      }
    }

    console.log(`   Task IDs: ${taskIds.size}`);
    console.log(`   DDT Library IDs: ${ddtIds.size}`);
    console.log(`   ID duplicati (stesso ID): ${duplicateIds.length}`);
    console.log(`   DDT Library IDs che iniziano con 'ddt_': ${ddtIdsStartingWithDDT.length}`);
    console.log(`   DDT Library IDs che corrispondono a Task IDs (con prefisso ddt_): ${ddtIdsMatchingTasks.length}\n`);

    if (duplicateIds.length > 0) {
      console.log('   ⚠️  Trovati ID duplicati (stesso ID):');
      duplicateIds.forEach(id => {
        const task = tasks.find(t => (t.id || t._id?.toString()) === id);
        const ddt = ddtLibrary.find(d => (d.id || d._id?.toString()) === id);
        console.log(`      - ${id}:`);
        console.log(`         Task: ${task?.label || 'N/A'}, mainData: ${task?.mainData?.length || 0}`);
        console.log(`         DDT Library: ${ddt?.label || 'N/A'}, mainData: ${ddt?.ddt?.mainData?.length || 0}`);
      });
      console.log();
    }

    if (ddtIdsMatchingTasks.length > 0) {
      console.log('   ⚠️  DDT Library con ID che corrispondono a Task IDs (prefisso ddt_):');
      ddtIdsMatchingTasks.slice(0, 5).forEach(({ ddtId, taskId }) => {
        const task = tasks.find(t => (t.id || t._id?.toString()) === taskId);
        const ddt = ddtLibrary.find(d => (d.id || d._id?.toString()) === ddtId);
        console.log(`      - DDT Library: ${ddtId} → Task: ${taskId}`);
        console.log(`         Task: ${task?.label || 'N/A'}, mainData: ${task?.mainData?.length || 0}`);
        console.log(`         DDT Library: ${ddt?.label || 'N/A'}, mainData: ${ddt?.ddt?.mainData?.length || 0}`);
      });
      console.log();
    }

    // ===================================
    // 4. VERIFICA SE ddt_library È RIDONDANTE
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 CONCLUSIONI');
    console.log('='.repeat(70));

    console.log(`\n1. Tasks con DDT completo: ${tasksWithFullDDT}/${tasks.length}`);
    console.log(`   - Hanno mainData con steps dentro i nodi`);
    console.log(`   - Hanno stepPrompts a root level`);

    console.log(`\n2. ddt_library: ${ddtLibrary.length} DDT`);
    console.log(`   - DDT con mainData: ${ddtWithMainData}`);
    console.log(`   - DDT con steps: ${ddtWithSteps}`);
    console.log(`   - DDT compositi: ${ddtWithComposition}`);

    console.log(`\n3. Duplicati:`);
    console.log(`   - ID identici: ${duplicateIds.length}`);
    console.log(`   - ID con prefisso ddt_: ${ddtIdsMatchingTasks.length}`);

    console.log('\n💡 ANALISI:');

    if (tasksWithFullDDT > 0 && ddtLibrary.length > 0) {
      if (duplicateIds.length > 0 || ddtIdsMatchingTasks.length > 0) {
        console.log('   ⚠️  TROVATI DUPLICATI - ddt_library potrebbe essere ridondante');
        console.log('   💡 I task templates hanno già DDT nei loro mainData');
        console.log('   💡 ddt_library contiene DDT che potrebbero essere già nei Tasks');
        console.log('   💡 Verifica se ddt_library serve solo per scope filtering separato');
      } else {
        console.log('   ✅ Nessun duplicato diretto');
        console.log('   💡 ddt_library potrebbe servire per:');
        console.log('      - DDT standalone (non associati a task templates)');
        console.log('      - DDT compositi (composition.includes)');
        console.log('      - DDT con scope filtering separato');
      }
    } else if (tasksWithFullDDT === 0 && ddtLibrary.length > 0) {
      console.log('   ✅ Tasks NON hanno DDT - ddt_library serve');
    } else if (tasksWithFullDDT > 0 && ddtLibrary.length === 0) {
      console.log('   ✅ Tasks hanno DDT - ddt_library vuota (già migrata?)');
    }

    // Verifica se ddt_library serve per DDT compositi
    if (ddtWithComposition > 0) {
      console.log(`\n   ⚠️  ddt_library ha ${ddtWithComposition} DDT compositi`);
      console.log('   💡 Questi DDT compositi potrebbero non essere nei task templates');
      console.log('   💡 ddt_library serve per DDT che referenziano altri DDT (composition.includes)');
    }

    // Verifica scope
    if (ddtLibrary.length > 0) {
      const scopes = {};
      ddtLibrary.forEach(ddt => {
        const scope = ddt.scope || 'unknown';
        scopes[scope] = (scopes[scope] || 0) + 1;
      });
      console.log(`\n   📊 Scope distribution in ddt_library:`);
      Object.entries(scopes).forEach(([scope, count]) => {
        console.log(`      - ${scope}: ${count} DDT`);
      });

      const hasClientScope = Object.keys(scopes).some(s => s.startsWith('client:'));
      if (hasClientScope) {
        console.log(`\n   💡 ddt_library ha DDT con scope client-specific`);
        console.log(`   💡 Questi DDT potrebbero essere separati dai task templates per scope filtering`);
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

