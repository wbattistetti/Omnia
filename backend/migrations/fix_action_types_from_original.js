/**
 * Fix: Mappa correttamente le action che hanno type: 3 ma sono action
 *
 * Le action in Task_Templates originale hanno type: 3 (DataRequest) ma sono chiaramente action.
 * Questo script le corregge mappandole ai nuovi enum (6-19).
 *
 * Esegui con: node backend/migrations/fix_action_types_from_original.js
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

const TaskType = {
  SayMessage: 0,
  SendSMS: 6,
  SendEmail: 7,
  EscalateToHuman: 8,
  EscalateToGuardVR: 9,
  ReadFromBackend: 10,
  WriteToBackend: 11,
  LogData: 12,
  LogLabel: 13,
  PlayJingle: 14,
  Jump: 15,
  HangUp: 16,
  Assign: 17,
  Clear: 18,
  WaitForAgent: 19
};

// ✅ Mapping dettagliato basato su id e label
const ACTION_MAPPING = {
  // Per ID
  '654412d5-381e-43e3-b780-4d26e85ce37e': TaskType.SayMessage, // Message
  'a6422ac7-f897-4fd6-b0cf-a60ba99e8b30': TaskType.SendSMS, // Send SMS
  'readFromBackend-template': TaskType.ReadFromBackend,
  'escalateToHuman-template': TaskType.EscalateToHuman,
  'writeToBackend-template': TaskType.WriteToBackend,
  'waitForAgent-template': TaskType.WaitForAgent,
  '49f4b669-0215-4955-811a-91ab01363687': TaskType.EscalateToGuardVR, // To Bot Guard
  '9563e605-7c9f-4fe4-ab42-e0a65904ee70': TaskType.HangUp, // Hang Up
  'f90bfda0-2534-4c50-a433-626107faaff4': TaskType.Assign, // Assign
  '4e0c27cb-3286-4341-adb9-ab9d56d652db': TaskType.PlayJingle, // Play Jingle
  'fdcd8cc4-fe13-4fb5-885e-83443e2c8e1b': TaskType.Clear, // Clear
  'aa96dab7-2b9a-4845-bda3-51571163a198': TaskType.SayMessage, // Question → SayMessage
  '24c98977-2585-4215-ac46-922001a02c1a': TaskType.SendEmail, // Send Email
  'cf406ebb-007a-4f31-b671-1a180594a69c': TaskType.Jump, // Jump
  'ea7ccaa5-e499-455d-8229-533efd70c7f8': TaskType.LogData, // Log Data
  '25543b84-840f-4cbb-944e-e3d54d01aafe': TaskType.LogLabel, // Log Label
};

// ✅ Mapping per label (fallback)
function findActionTypeByLabel(label) {
  if (!label) return null;
  const labelLower = label.toLowerCase();

  if (labelLower.includes('send sms') || labelLower === 'send sms') return TaskType.SendSMS;
  if (labelLower.includes('send email') || labelLower === 'send email') return TaskType.SendEmail;
  if (labelLower.includes('to attendant') || labelLower.includes('escalate to human')) return TaskType.EscalateToHuman;
  if (labelLower.includes('to bot guard') || labelLower.includes('escalate to guard')) return TaskType.EscalateToGuardVR;
  if (labelLower.includes('read from backend') || labelLower === 'read from backend') return TaskType.ReadFromBackend;
  if (labelLower.includes('write to backend') || labelLower === 'write to backend') return TaskType.WriteToBackend;
  if (labelLower.includes('wait for agent') || labelLower === 'wait for agent') return TaskType.WaitForAgent;
  if (labelLower.includes('hang up') || labelLower === 'hang up') return TaskType.HangUp;
  if (labelLower.includes('assign') || labelLower === 'assign') return TaskType.Assign;
  if (labelLower.includes('play jingle') || labelLower === 'play jingle') return TaskType.PlayJingle;
  if (labelLower.includes('clear') || labelLower === 'clear') return TaskType.Clear;
  if (labelLower.includes('jump') || labelLower === 'jump') return TaskType.Jump;
  if (labelLower.includes('log data') || labelLower === 'log data') return TaskType.LogData;
  if (labelLower.includes('log label') || labelLower === 'log label') return TaskType.LogLabel;
  if (labelLower.includes('question') || labelLower === 'question') return TaskType.SayMessage;
  if (labelLower.includes('message') && !labelLower.includes('send')) return TaskType.SayMessage;

  return null;
}

async function fixActionTypesFromOriginal() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connesso a MongoDB\n');

    const db = client.db(dbFactory);
    const tasksColl = db.collection('Tasks');

    // Trova tutti i task con type: 3 che potrebbero essere action
    const tasksWithType3 = await tasksColl.find({ type: 3 }).toArray();
    console.log(`📋 Trovati ${tasksWithType3.length} task con type: 3\n`);

    // Cerca nella collection originale per identificare le action
    const originalColl = db.collection('Task_Templates');
    const originalActions = await originalColl.find({
      taskType: { $regex: /^action$/i }
    }).toArray();

    console.log(`📋 Trovate ${originalActions.length} action in Task_Templates originale\n`);

    const fixes = [];

    // Per ogni action originale, trova il task corrispondente e correggi
    for (const action of originalActions) {
      const actionId = action.id || action.name || action._id;
      const actionLabel = action.label || '';

      // Cerca il task corrispondente
      const task = await tasksColl.findOne({
        $or: [
          { id: actionId },
          { _id: actionId },
          { label: actionLabel }
        ]
      });

      if (!task) {
        console.log(`⚠️  Task non trovato per action: ${actionId} - "${actionLabel}"`);
        continue;
      }

      // Determina il tipo corretto
      let correctType = ACTION_MAPPING[actionId];
      if (!correctType) {
        correctType = findActionTypeByLabel(actionLabel);
      }

      if (correctType !== null && correctType !== task.type) {
        fixes.push({
          id: task.id,
          label: task.label,
          oldType: task.type,
          newType: correctType,
          actionId: actionId,
          actionLabel: actionLabel
        });
      }
    }

    console.log(`🔍 Trovate ${fixes.length} action da correggere\n`);

    if (fixes.length === 0) {
      console.log('✅ Nessuna correzione necessaria');
      return;
    }

    // Preview
    console.log('📝 Preview correzioni:');
    fixes.forEach((fix, idx) => {
      console.log(`   ${idx + 1}. ${fix.id}: "${fix.label}" (${fix.oldType} → ${fix.newType})`);
    });

    // Applica correzioni
    console.log('\n🔄 Applicazione correzioni...\n');
    let fixedCount = 0;
    for (const fix of fixes) {
      await tasksColl.updateOne(
        { id: fix.id },
        { $set: { type: fix.newType } }
      );
      fixedCount++;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RIEPILOGO CORREZIONI');
    console.log('='.repeat(80));
    console.log(`   Action corrette: ${fixedCount}`);
    console.log('='.repeat(80));
    console.log('\n🎉 CORREZIONI COMPLETATE');

  } catch (error) {
    console.error('\n❌ Errore durante le correzioni:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Connessione chiusa');
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  fixActionTypesFromOriginal()
    .then(() => {
      console.log('\n✅ Script completato');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script fallito:', error);
      process.exit(1);
    });
}

module.exports = { fixActionTypesFromOriginal };

