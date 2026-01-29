/**
 * Analizza la struttura completa dei task DataRequest per capire come sono strutturati i DDT
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function analyze() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);

    const dataRequestTasks = await db.collection('Tasks').find({ type: 3 }).toArray();
    console.log(`📋 Analizzando ${dataRequestTasks.length} task DataRequest...\n`);

    if (dataRequestTasks.length === 0) {
      console.log('⚠️  Nessun task DataRequest trovato\n');
      return;
    }

    // Prendi un esempio completo
    const sample = dataRequestTasks[0];

    console.log('='.repeat(70));
    console.log('📋 Esempio completo task DataRequest:');
    console.log('='.repeat(70));
    console.log(`ID: ${sample.id}`);
    console.log(`Label: ${sample.label || 'N/A'}`);
    console.log(`Type: ${sample.type}`);
    console.log(`TemplateId: ${sample.templateId || 'null'}`);
    console.log(`Name: ${sample.name || 'N/A'}`);
    console.log();

    console.log('Campi presenti:');
    Object.keys(sample).forEach(key => {
      const value = sample[key];
      let preview = '';
      if (value === null || value === undefined) {
        preview = 'null/undefined';
      } else if (Array.isArray(value)) {
        preview = `array[${value.length}]`;
      } else if (typeof value === 'object') {
        preview = `object{${Object.keys(value).length} keys}`;
      } else {
        preview = String(value).substring(0, 50);
      }
      console.log(`  - ${key}: ${preview}`);
    });
    console.log();

    // Analizza mainData
    console.log('mainData:');
    if (sample.mainData) {
      if (Array.isArray(sample.mainData)) {
        console.log(`  - Tipo: array[${sample.mainData.length}]`);
        if (sample.mainData.length > 0) {
          console.log(`  - mainData[0] keys: ${Object.keys(sample.mainData[0]).join(', ')}`);
          if (sample.mainData[0].steps) {
            console.log(`  - mainData[0].steps: ${typeof sample.mainData[0].steps}`);
            if (typeof sample.mainData[0].steps === 'object') {
              console.log(`  - mainData[0].steps keys: ${Object.keys(sample.mainData[0].steps).join(', ')}`);
            }
          }
        }
      } else {
        console.log(`  - Tipo: ${typeof sample.mainData}`);
        console.log(`  - Valore: ${JSON.stringify(sample.mainData).substring(0, 200)}`);
      }
    } else {
      console.log('  - Assente');
    }
    console.log();

    // Analizza steps (root level)
    console.log('steps (root level):');
    if (sample.steps) {
      if (typeof sample.steps === 'object') {
        console.log(`  - Tipo: object`);
        console.log(`  - Keys: ${Object.keys(sample.steps).join(', ')}`);
        console.log(`  - Sample step (start):`, JSON.stringify(sample.steps.start || sample.steps[Object.keys(sample.steps)[0]] || {}, null, 2).substring(0, 300));
      } else {
        console.log(`  - Tipo: ${typeof sample.steps}`);
        console.log(`  - Valore: ${String(sample.steps).substring(0, 200)}`);
      }
    } else {
      console.log('  - Assente');
    }
    console.log();

    // Analizza steps
    console.log('steps (root level):');
    if (sample.steps) {
      if (typeof sample.steps === 'object') {
        console.log(`  - Tipo: object`);
        console.log(`  - Keys: ${Object.keys(sample.steps).join(', ')}`);
        console.log(`  - Sample steps:`, JSON.stringify(sample.steps, null, 2).substring(0, 300));
      } else {
        console.log(`  - Tipo: ${typeof sample.steps}`);
      }
    } else {
      console.log('  - Assente');
    }
    console.log();

    // Analizza dataContracts
    console.log('dataContracts:');
    if (sample.dataContracts) {
      if (Array.isArray(sample.dataContracts)) {
        console.log(`  - Tipo: array[${sample.dataContracts.length}]`);
        if (sample.dataContracts.length > 0) {
          console.log(`  - Sample:`, JSON.stringify(sample.dataContracts[0], null, 2).substring(0, 200));
        }
      } else {
        console.log(`  - Tipo: ${typeof sample.dataContracts}`);
      }
    } else {
      console.log('  - Assente');
    }
    console.log();

    // ===================================
    // VERIFICA STRUTTURA DDT
    // ===================================
    console.log('='.repeat(70));
    console.log('📊 ANALISI STRUTTURA DDT:');
    console.log('='.repeat(70));

    const hasMainData = sample.mainData && Array.isArray(sample.mainData) && sample.mainData.length > 0;
    const hasStepsRoot = sample.steps && typeof sample.steps === 'object' && Object.keys(sample.steps).length > 0;
    const hassteps = sample.steps && typeof sample.steps === 'object' && Object.keys(sample.steps).length > 0;
    const hasDataContracts = sample.dataContracts && Array.isArray(sample.dataContracts) && sample.dataContracts.length > 0;

    console.log(`\n1. mainData: ${hasMainData ? '✅ Presente' : '❌ Assente'}`);
    console.log(`2. steps (root): ${hasStepsRoot ? '✅ Presente' : '❌ Assente'}`);
    console.log(`3. steps (root): ${hassteps ? '✅ Presente' : '❌ Assente'}`);
    console.log(`4. dataContracts: ${hasDataContracts ? '✅ Presente' : '❌ Assente'}`);

    console.log('\n💡 INTERPRETAZIONE:');

    if (hasMainData) {
      console.log('   ✅ Task ha mainData - DDT completo con struttura gerarchica');
    } else if (hasStepsRoot && hassteps) {
      console.log('   ⚠️  Task ha steps e steps a root level, ma NON ha mainData');
      console.log('   💡 Questo è un DDT "flat" - steps senza struttura gerarchica mainData');
      console.log('   💡 Forse è un formato legacy o una struttura semplificata');
    } else if (hassteps) {
      console.log('   ⚠️  Task ha solo steps, ma NON ha mainData né steps');
      console.log('   💡 Questo è un template DDT senza struttura - solo prompt');
    } else {
      console.log('   ❌ Task NON ha DDT - è solo un template senza struttura');
    }

    // Verifica se steps contiene struttura DDT
    if (hasStepsRoot) {
      console.log('\n   📋 Analisi steps (root level):');
      const stepKeys = Object.keys(sample.steps);
      console.log(`   - Step keys: ${stepKeys.join(', ')}`);

      // Verifica se steps ha escalations con tasks
      const firstStep = sample.steps[stepKeys[0]];
      if (firstStep && typeof firstStep === 'object') {
        console.log(`   - First step keys: ${Object.keys(firstStep).join(', ')}`);
        if (firstStep.escalations) {
          console.log(`   - Ha escalations: Sì`);
          if (Array.isArray(firstStep.escalations) && firstStep.escalations.length > 0) {
            console.log(`   - Escalations count: ${firstStep.escalations.length}`);
            if (firstStep.escalations[0].tasks) {
              console.log(`   - Escalations hanno tasks: Sì`);
            }
          }
        }
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
  analyze().catch(console.error);
}

module.exports = { analyze };

