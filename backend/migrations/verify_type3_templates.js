// Verification script: Check for type 3 templates and templates with constraints but no invalid step
// Run this to see what needs to be cleaned

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory'; // lowercase as used in server.js

/**
 * Check if template has constraints but no invalid step
 */
function hasConstraintsButNoInvalid(template) {
  // Check for constraints
  const hasConstraints = template.constraints &&
    Array.isArray(template.constraints) &&
    template.constraints.length > 0 &&
    template.constraints.some(c => c && c.kind && c.kind !== 'required');

  if (!hasConstraints) {
    return false;
  }

  // Check for invalid step in steps
  let hasInvalidStep = false;

  if (template.steps && typeof template.steps === 'object') {
    for (const [nodeId, nodeSteps] of Object.entries(template.steps)) {
      if (nodeSteps && typeof nodeSteps === 'object') {
        if (nodeSteps.invalid) {
          hasInvalidStep = true;
          break;
        }
      }
    }
  }

  // Check for invalid step in nodes
  if (!hasInvalidStep && template.nodes && Array.isArray(template.nodes)) {
    for (const node of template.nodes) {
      if (node.steps && typeof node.steps === 'object') {
        if (node.steps.invalid) {
          hasInvalidStep = true;
          break;
        }
      }
    }
  }

  return !hasInvalidStep;
}

async function verifyTemplates() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    // Templates are stored in 'tasks' collection (lowercase) as per server.js
    const templatesColl = db.collection('tasks');

    // Find all templates
    const allTemplates = await templatesColl.find({}).toArray();
    console.log(`📋 Total templates in Factory: ${allTemplates.length}\n`);

    // Check type 3 templates (also check for string types)
    const type3Templates = allTemplates.filter(t =>
      t.type === 3 ||
      (typeof t.type === 'string' && /^(datarequest|data)$/i.test(t.type)) ||
      (t.name && /^(datarequest|getdata|data)$/i.test(t.name))
    );
    console.log(`🔍 Type 3 templates: ${type3Templates.length}`);
    if (type3Templates.length > 0) {
      type3Templates.forEach(t => {
        console.log(`   - ${t.id || t._id} (${t.label || 'no label'})`);
      });
    }

    // Check templates with constraints but no invalid step
    console.log(`\n🔍 Templates with constraints but no invalid step:`);
    const problematicTemplates = allTemplates.filter(hasConstraintsButNoInvalid);
    console.log(`   Found: ${problematicTemplates.length}`);

    if (problematicTemplates.length > 0) {
      problematicTemplates.forEach(t => {
        const constraintCount = t.constraints ? t.constraints.filter(c => c && c.kind && c.kind !== 'required').length : 0;
        console.log(`   - ${t.id || t._id} (${t.label || 'no label'}) - ${constraintCount} constraint(s)`);
      });
    }

    // Check templates without type field
    const templatesWithoutType = allTemplates.filter(t => t.type === undefined || t.type === null);
    console.log(`\n🔍 Templates without type field: ${templatesWithoutType.length}`);
    if (templatesWithoutType.length > 0 && templatesWithoutType.length <= 10) {
      templatesWithoutType.forEach(t => {
        console.log(`   - ${t.id || t._id} (${t.label || 'no label'})`);
      });
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
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
