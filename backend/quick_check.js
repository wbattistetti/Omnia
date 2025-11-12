const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function check() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('factory');

    const template = await db.collection('Templates').findOne({
      $or: [{kind: 'time'}, {type: 'time'}, {name: 'time'}]
    });

    if (!template) {
      console.log('❌ Time template not found');
      return;
    }

    console.log('✅ Time template found');
    console.log('\nSub-data items:');
    const subData = template.subData || [];

    subData.forEach((sub, idx) => {
      const hasPrompts = !!(sub.stepPrompts && typeof sub.stepPrompts === 'object' && Object.keys(sub.stepPrompts).length > 0);
      console.log(`\n${idx + 1}. ${sub.label}:`);
      console.log(`   hasStepPrompts: ${hasPrompts ? '✅ YES' : '❌ NO'}`);

      if (hasPrompts) {
        Object.entries(sub.stepPrompts).forEach(([key, values]) => {
          console.log(`   ${key}: ${Array.isArray(values) ? `[${values.length} keys]` : values}`);
          if (Array.isArray(values)) {
            values.forEach(v => console.log(`     - ${v}`));
          }
        });
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

check();

