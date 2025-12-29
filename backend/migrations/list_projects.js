/**
 * Script: Lista tutti i progetti nel database
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';

async function listProjects() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const projectsCollection = db.collection('Projects');

    const projects = await projectsCollection.find({}).toArray();

    console.log(`\n📊 Found ${projects.length} projects:\n`);

    projects.forEach((project, idx) => {
      console.log(`${idx + 1}. Project: "${project.name}" (id: ${project._id})`);
      console.log(`   - Created: ${project.createdAt || 'N/A'}`);
      console.log(`   - Updated: ${project.updatedAt || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

listProjects()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

