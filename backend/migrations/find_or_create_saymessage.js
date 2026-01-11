/**
 * Find or create SayMessage task for escalation (Prompt/Message)
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function findOrCreateSayMessage() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbFactory);
    const coll = db.collection('Tasks');

    // Try to find existing SayMessage for escalation
    const existing = await coll.findOne({
      type: 0,
      allowedContexts: { $in: ['escalation'] }
    });

    if (existing) {
      console.log('✅ Found existing SayMessage task for escalation:');
      console.log(`   ID: ${existing.id || existing._id}`);
      console.log(`   Label: ${existing.label || 'N/A'}`);
      console.log(`   Type: ${existing.type} (SayMessage)`);
      console.log(`   allowedContexts: ${JSON.stringify(existing.allowedContexts || [])}`);
      return;
    }

    // Check if there's a "sayMessage" template with different ID
    const sayMessageVariants = await coll.find({
      $or: [
        { id: 'sayMessage' },
        { _id: 'sayMessage' },
        { label: { $regex: /^(say\s*message|message|prompt)$/i } },
        { templateId: 'sayMessage' }
      ]
    }).toArray();

    if (sayMessageVariants.length > 0) {
      console.log(`📊 Found ${sayMessageVariants.length} potential SayMessage variants:\n`);
      sayMessageVariants.forEach((task, idx) => {
        console.log(`${idx + 1}. ${task.label || task.id || 'N/A'}`);
        console.log(`   ID: ${task.id || task._id}`);
        console.log(`   Type: ${task.type} (${getTypeName(task.type)})`);
        console.log(`   allowedContexts: ${JSON.stringify(task.allowedContexts || [])}`);
        console.log('');
      });

      // Check if any can be updated
      const updatable = sayMessageVariants.find(t => t.type === 0);
      if (updatable) {
        console.log('🔧 Found SayMessage (type: 0) that can be updated...');
        const result = await coll.updateOne(
          { id: updatable.id || updatable._id },
          { $set: { allowedContexts: ['escalation'] } }
        );
        if (result.modifiedCount > 0) {
          console.log(`   ✅ Updated: ${updatable.label || updatable.id} - added allowedContexts: ['escalation']`);
        }
        return;
      }
    }

    // Create new SayMessage task for escalation
    console.log('📝 Creating new SayMessage task for escalation...\n');

    const newTask = {
      id: 'sayMessage',
      _id: 'sayMessage',
      type: 0, // SayMessage
      label: 'Message',
      description: 'Add a text message to the escalation',
      icon: 'MessageCircle',
      color: 'text-blue-500',
      allowedContexts: ['escalation'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const result = await coll.insertOne(newTask);
      console.log(`✅ Created new SayMessage task:`);
      console.log(`   ID: ${newTask.id}`);
      console.log(`   Label: ${newTask.label}`);
      console.log(`   Type: ${newTask.type} (SayMessage)`);
      console.log(`   allowedContexts: ${JSON.stringify(newTask.allowedContexts)}`);
    } catch (insertError) {
      if (insertError.code === 11000) {
        // Duplicate key error - task already exists with this ID
        console.log('⚠️  Task with ID "sayMessage" already exists, trying to update...');
        const updateResult = await coll.updateOne(
          { id: 'sayMessage' },
          {
            $set: {
              type: 0,
              label: 'Message',
              allowedContexts: ['escalation'],
              updatedAt: new Date()
            }
          }
        );
        if (updateResult.modifiedCount > 0) {
          console.log('   ✅ Updated existing task to be SayMessage with escalation context');
        } else {
          console.log('   ⚠️  Task exists but update was not needed or failed');
        }
      } else {
        throw insertError;
      }
    }

    // Verify
    const verify = await coll.findOne({
      type: 0,
      allowedContexts: { $in: ['escalation'] }
    });

    if (verify) {
      console.log('\n✅ Verification: SayMessage task for escalation is now available');
      console.log(`   ID: ${verify.id || verify._id}`);
      console.log(`   Label: ${verify.label || 'N/A'}`);
    } else {
      console.log('\n⚠️  Warning: SayMessage task for escalation not found after creation');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

function getTypeName(type) {
  switch (type) {
    case 0: return 'SayMessage';
    case 1: return 'CloseSession';
    case 2: return 'Transfer';
    case 3: return 'DataRequest';
    case 4: return 'BackendCall';
    case 5: return 'ClassifyProblem';
    case 6: return 'SendSMS';
    case 7: return 'SendEmail';
    case 8: return 'EscalateToHuman';
    case 9: return 'EscalateToGuardVR';
    case 10: return 'ReadFromBackend';
    case 11: return 'WriteToBackend';
    case 12: return 'LogData';
    case 13: return 'LogLabel';
    case 14: return 'PlayJingle';
    case 15: return 'Jump';
    case 16: return 'HangUp';
    case 17: return 'Assign';
    case 18: return 'Clear';
    case 19: return 'WaitForAgent';
    default: return 'UNKNOWN';
  }
}

findOrCreateSayMessage()
  .then(() => {
    console.log('\n🎉 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
