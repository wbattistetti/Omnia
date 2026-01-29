/**
 * Script per verificare che tutti i template siano stati semplificati correttamente
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_NAME = 'factory';

async function verifyAllTemplates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const templatesCollection = db.collection('Task_Templates');

    const templates = await templatesCollection.find({}).toArray();
    console.log(`📦 Found ${templates.length} templates\n`);

    const issues = {
      hasDataType: [],
      hasMainData: [],
      missingSubDataIds: [],
      stepsInMetadata: [],
      hasMetadataFlags: []
    };

    templates.forEach(template => {
      const label = template.label || template.name || template._id;

      if (template.dataType !== undefined) {
        issues.hasDataType.push(label);
      }

      if (template.mainData !== undefined) {
        issues.hasMainData.push(label);
      }

      if (template.subDataIds === undefined) {
        issues.missingSubDataIds.push(label);
      }

      if (template.metadata?.steps !== undefined) {
        issues.stepsInMetadata.push(label);
      }

      if (template.metadata?.isMainData !== undefined || template.metadata?.isSubData !== undefined) {
        issues.hasMetadataFlags.push(label);
      }
    });

    console.log('='.repeat(70));
    console.log('📊 VERIFICA TEMPLATE');
    console.log('='.repeat(70));

    console.log(`\n✅ Templates con dataType: ${issues.hasDataType.length}`);
    if (issues.hasDataType.length > 0) {
      console.log(`   ${issues.hasDataType.slice(0, 5).join(', ')}${issues.hasDataType.length > 5 ? '...' : ''}`);
    }

    console.log(`\n✅ Templates con mainData: ${issues.hasMainData.length}`);
    if (issues.hasMainData.length > 0) {
      console.log(`   ${issues.hasMainData.slice(0, 5).join(', ')}${issues.hasMainData.length > 5 ? '...' : ''}`);
    }

    console.log(`\n❌ Templates senza subDataIds: ${issues.missingSubDataIds.length}`);
    if (issues.missingSubDataIds.length > 0) {
      console.log(`   ${issues.missingSubDataIds.slice(0, 5).join(', ')}${issues.missingSubDataIds.length > 5 ? '...' : ''}`);
    }

    console.log(`\n❌ Templates con steps in metadata: ${issues.stepsInMetadata.length}`);
    if (issues.stepsInMetadata.length > 0) {
      console.log(`   ${issues.stepsInMetadata.slice(0, 5).join(', ')}${issues.stepsInMetadata.length > 5 ? '...' : ''}`);
    }

    console.log(`\n❌ Templates con metadata flags: ${issues.hasMetadataFlags.length}`);
    if (issues.hasMetadataFlags.length > 0) {
      console.log(`   ${issues.hasMetadataFlags.slice(0, 5).join(', ')}${issues.hasMetadataFlags.length > 5 ? '...' : ''}`);
    }

    const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);

    console.log(`\n${'='.repeat(70)}`);
    if (totalIssues === 0) {
      console.log('✅ TUTTI I TEMPLATE SONO STATI SEMPLIFICATI CORRETTAMENTE!');
    } else {
      console.log(`⚠️  Trovati ${totalIssues} problemi da risolvere`);
    }
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

verifyAllTemplates().catch(console.error);

