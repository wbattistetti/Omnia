/**
 * Script: Ricerca approfondita di task elementari in Tasks
 *
 * Cerca task con vari pattern per email, phone, date, dateOfBirth
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

const TaskType = {
  DataRequest: 3
};

async function deepSearch() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');
    console.log('='.repeat(80));
    console.log('🔍 RICERCA APPROFONDITA TASK ELEMENTARI');
    console.log('='.repeat(80));
    console.log();

    const db = client.db(dbFactory);

    // Cerca tutti i task DataRequest
    const allDataRequestTasks = await db.collection('Tasks').find({
      type: TaskType.DataRequest
    }).toArray();

    console.log(`📋 Trovati ${allDataRequestTasks.length} task DataRequest totali\n`);

    // Cerca pattern per email
    console.log('📧 RICERCA EMAIL:');
    console.log('-'.repeat(80));
    const emailTasks = allDataRequestTasks.filter(t => {
      const name = (t.name || '').toLowerCase();
      const label = (t.label || '').toLowerCase();
      const id = (t.id || '').toLowerCase();
      return name.includes('email') || label.includes('email') || id.includes('email');
    });
    console.log(`   Trovati ${emailTasks.length} task con "email":`);
    emailTasks.forEach(t => {
      console.log(`   - ID: ${t.id || t._id}`);
      console.log(`     name: ${t.name || 'N/A'}`);
      console.log(`     label: ${t.label || 'N/A'}`);
      console.log(`     nlpContract: ${t.nlpContract || (t.mainData && t.mainData[0]?.nlpContract) ? '✅' : '❌'}`);
      console.log();
    });

    // Cerca pattern per phone
    console.log('📞 RICERCA PHONE:');
    console.log('-'.repeat(80));
    const phoneTasks = allDataRequestTasks.filter(t => {
      const name = (t.name || '').toLowerCase();
      const label = (t.label || '').toLowerCase();
      const id = (t.id || '').toLowerCase();
      return name.includes('phone') || label.includes('phone') || label.includes('telefono') || id.includes('phone');
    });
    console.log(`   Trovati ${phoneTasks.length} task con "phone":`);
    phoneTasks.forEach(t => {
      console.log(`   - ID: ${t.id || t._id}`);
      console.log(`     name: ${t.name || 'N/A'}`);
      console.log(`     label: ${t.label || 'N/A'}`);
      console.log(`     nlpContract: ${t.nlpContract || (t.mainData && t.mainData[0]?.nlpContract) ? '✅' : '❌'}`);
      console.log();
    });

    // Cerca pattern per date/dateOfBirth
    console.log('📅 RICERCA DATE/DATEOFBIRTH:');
    console.log('-'.repeat(80));
    const dateTasks = allDataRequestTasks.filter(t => {
      const name = (t.name || '').toLowerCase();
      const label = (t.label || '').toLowerCase();
      const id = (t.id || '').toLowerCase();
      return name.includes('date') || label.includes('date') || label.includes('data') ||
             name.includes('birth') || label.includes('birth') || label.includes('nascita') ||
             id.includes('date') || id.includes('birth');
    });
    console.log(`   Trovati ${dateTasks.length} task con "date/birth":`);
    dateTasks.forEach(t => {
      console.log(`   - ID: ${t.id || t._id}`);
      console.log(`     name: ${t.name || 'N/A'}`);
      console.log(`     label: ${t.label || 'N/A'}`);
      console.log(`     nlpContract: ${t.nlpContract || (t.mainData && t.mainData[0]?.nlpContract) ? '✅' : '❌'}`);
      console.log();
    });

    // Mostra tutti i task elementari (senza subData o con subData vuoto)
    console.log('📋 TASK ELEMENTARI (senza subData o subData vuoto):');
    console.log('-'.repeat(80));
    const elementariTasks = allDataRequestTasks.filter(t => {
      if (!t.mainData || t.mainData.length === 0) return true;
      if (t.mainData.length === 1 && (!t.mainData[0].subData || t.mainData[0].subData.length === 0)) return true;
      return false;
    });
    console.log(`   Trovati ${elementariTasks.length} task elementari:\n`);
    elementariTasks.forEach(t => {
      console.log(`   - ${t.name || t.label || t.id || t._id}`);
      console.log(`     ID: ${t.id || t._id}`);
      console.log(`     type: ${t.type}`);
      console.log(`     mainData: ${t.mainData?.length || 0} nodi`);
      if (t.mainData && t.mainData.length > 0) {
        console.log(`     mainData[0].subData: ${t.mainData[0].subData?.length || 0} sub-nodi`);
      }
      console.log();
    });

    console.log('='.repeat(80));
    console.log('✅ Ricerca completata');
    console.log('='.repeat(80));

    return { emailTasks, phoneTasks, dateTasks, elementariTasks };

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

if (require.main === module) {
  deepSearch().catch(console.error);
}

module.exports = { deepSearch };

