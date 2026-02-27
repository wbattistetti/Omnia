// Script di verifica - SOLO LETTURA, non modifica nulla
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function verifyTemplates() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected\n');

    const db = client.db(dbFactory);
    const tasksColl = db.collection('tasks');

    // Conta totale
    const totalCount = await tasksColl.countDocuments();
    console.log(`📋 Total templates in Factory: ${totalCount}\n`);

    // Conta per tipo
    const type3Count = await tasksColl.countDocuments({ type: 3 });
    const otherTypesCount = totalCount - type3Count;

    console.log(`📊 Breakdown:`);
    console.log(`   - Type 3 templates: ${type3Count}`);
    console.log(`   - Other types: ${otherTypesCount}\n`);

    // Lista template di tipo 3 (se ce ne sono)
    if (type3Count > 0) {
      console.log(`⚠️  Type 3 templates still present:`);
      const type3Templates = await tasksColl.find({ type: 3 }).toArray();
      type3Templates.forEach(t => {
        console.log(`   - ${t.id || t._id}: ${t.label || 'no label'}`);
      });
    } else {
      console.log(`✅ No type 3 templates found (correct!)`);
    }

    // Lista altri tipi (primi 5)
    if (otherTypesCount > 0) {
      console.log(`\n📝 Other template types (first 5):`);
      const otherTemplates = await tasksColl.find({ type: { $ne: 3 } }).limit(5).toArray();
      otherTemplates.forEach(t => {
        console.log(`   - ${t.id || t._id}: ${t.label || 'no label'}, type: ${t.type}`);
      });
    }

    // Verifica se ci sono template con constraints ma senza invalid step
    console.log(`\n🔍 Checking templates with constraints but no invalid step...`);
    const allTemplates = await tasksColl.find({}).toArray();
    let problematicCount = 0;

    for (const template of allTemplates) {
      const hasConstraints = template.constraints &&
        Array.isArray(template.constraints) &&
        template.constraints.length > 0 &&
        template.constraints.some(c => c && c.kind && c.kind !== 'required');

      if (hasConstraints) {
        // Check for invalid step
        let hasInvalidStep = false;
        if (template.steps && typeof template.steps === 'object') {
          for (const [nodeId, nodeSteps] of Object.entries(template.steps)) {
            if (nodeSteps && typeof nodeSteps === 'object' && nodeSteps.invalid) {
              hasInvalidStep = true;
              break;
            }
          }
        }

        if (!hasInvalidStep) {
          problematicCount++;
          const constraintCount = template.constraints.filter(c => c && c.kind && c.kind !== 'required').length;
          console.log(`   ⚠️  ${template.id || template._id}: ${template.label || 'no label'} - ${constraintCount} constraint(s) but no invalid step`);
        }
      }
    }

    if (problematicCount === 0) {
      console.log(`   ✅ All templates with constraints have invalid step`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected');
  }
}

if (require.main === module) {
  verifyTemplates()
    .then(() => {
      console.log('\n✅ Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyTemplates };
