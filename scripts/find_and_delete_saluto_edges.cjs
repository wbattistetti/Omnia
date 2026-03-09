/**
 * Script: Cerca e rimuove edge "Saluto" orfani nel database
 * Database: t_no-client__p_voli__8785b552
 */

const { MongoClient } = require('mongodb');
const readline = require('readline');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const projectDbName = 't_no-client__p_voli__8785b552';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function findAndDeleteSalutoEdges() {
  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(projectDbName);
    const edgesCollection = db.collection('flow_edges');
    const nodesCollection = db.collection('flow_nodes');

    // Step 1: Find all edges with label "Saluto" (case-insensitive)
    console.log('🔍 Searching for edges with label "Saluto"...\n');
    const salutoEdges = await edgesCollection.find({
      label: { $regex: /^saluto$/i } // Case-insensitive match
    }).toArray();

    console.log(`📊 Found ${salutoEdges.length} edge(s) with label "Saluto":\n`);

    if (salutoEdges.length === 0) {
      console.log('✅ No edges with label "Saluto" found. Database is clean!');
      return;
    }

    // Step 2: Check which edges are orphan (point to non-existent nodes)
    const allNodeIds = new Set();
    const allNodes = await nodesCollection.find({}).toArray();
    allNodes.forEach(node => {
      allNodeIds.add(node.id);
    });

    console.log(`📋 Total nodes in database: ${allNodes.length}\n`);

    const orphanEdges = [];
    const validEdges = [];

    for (const edge of salutoEdges) {
      const sourceExists = allNodeIds.has(edge.source);
      const targetExists = allNodeIds.has(edge.target);
      const isOrphan = !sourceExists || !targetExists;

      console.log(`Edge ID: ${edge.id}`);
      console.log(`  Label: "${edge.label}"`);
      console.log(`  Source: ${edge.source} ${sourceExists ? '✅' : '❌ (NOT FOUND)'}`);
      console.log(`  Target: ${edge.target} ${targetExists ? '✅' : '❌ (NOT FOUND)'}`);
      console.log(`  FlowId: ${edge.flowId || 'main'}`);
      console.log(`  ConditionId: ${edge.conditionId || 'NONE'}`);
      console.log(`  Status: ${isOrphan ? '❌ ORPHAN' : '✅ VALID'}`);
      console.log('');

      if (isOrphan) {
        orphanEdges.push(edge);
      } else {
        validEdges.push(edge);
      }
    }

    // Step 3: Report findings
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`  Total "Saluto" edges: ${salutoEdges.length}`);
    console.log(`  Orphan edges: ${orphanEdges.length}`);
    console.log(`  Valid edges: ${validEdges.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 4: Delete orphan edges automatically
    if (orphanEdges.length > 0) {
      console.log('⚠️  Found orphan edges that will be deleted:');
      orphanEdges.forEach(edge => {
        console.log(`  - ${edge.id} (label: "${edge.label}", source: ${edge.source}, target: ${edge.target})`);
      });
      console.log('');

      const edgeIds = orphanEdges.map(e => e.id);
      const result = await edgesCollection.deleteMany({
        id: { $in: edgeIds }
      });
      console.log(`\n✅ Deleted ${result.deletedCount} orphan edge(s)`);
    }

    // Step 5: Warn about valid edges (if any)
    if (validEdges.length > 0) {
      console.log('\n⚠️  Found valid edges with label "Saluto" (not deleted):');
      validEdges.forEach(edge => {
        console.log(`  - ${edge.id} (label: "${edge.label}", source: ${edge.source}, target: ${edge.target})`);
      });
      console.log('\n💡 These edges are valid (point to existing nodes).');
      console.log('   If you want to delete them too, you need to do it manually from the UI.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
    rl.close();
  }
}

// Run script
findAndDeleteSalutoEdges()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    rl.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    rl.close();
    process.exit(1);
  });
