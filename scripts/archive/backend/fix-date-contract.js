const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function fixDateContract() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db(dbFactory);
        const collection = db.collection('Task_Templates');

        // Find Date template
        const dateTemplate = await collection.findOne({ name: 'Date' });

        if (!dateTemplate) {
            console.error('❌ Template "Date" not found in Task_Templates');
            return;
        }

        console.log('\n📋 Template Date found:', {
            id: dateTemplate.id || dateTemplate._id,
            name: dateTemplate.name,
            label: dateTemplate.label,
            hasContract: !!dateTemplate.nlpContract,
            subDataCount: (dateTemplate.subData || dateTemplate.subDataIds || []).length
        });

        // Check current contract state
        if (dateTemplate.nlpContract && dateTemplate.nlpContract.subDataMapping) {
            console.log('\n🔍 Current subDataMapping:');
            Object.entries(dateTemplate.nlpContract.subDataMapping).forEach(([id, mapping]) => {
                console.log(`  ${id.substring(0, 30)}... → canonicalKey: "${mapping.canonicalKey}", label: "${mapping.label}"`);
            });
        }

        // Get sub-data from Task_Templates using subDataIds
        console.log('\n🔍 Checking subData fields:', {
            hasSubData: 'subData' in dateTemplate,
            subDataIsArray: Array.isArray(dateTemplate.subData),
            hasSubDataIds: 'subDataIds' in dateTemplate,
            subDataIdsIsArray: Array.isArray(dateTemplate.subDataIds),
            subDataIdsLength: dateTemplate.subDataIds ? dateTemplate.subDataIds.length : 0
        });

        let subData = [];

        // ✅ CORRECTED: Check if we need to fetch sub-templates
        if (Array.isArray(dateTemplate.subData) && dateTemplate.subData.length > 0) {
            // Sub-data embedded directly
            subData = dateTemplate.subData;
            console.log('\n✅ Using embedded subData');
        } else if (Array.isArray(dateTemplate.subDataIds) && dateTemplate.subDataIds.length > 0) {
            // ✅ FIXED: subDataIds are STRINGS that represent ObjectId hex values
            console.log('\n🔍 Fetching sub-templates from Task_Templates using subDataIds:');
            dateTemplate.subDataIds.forEach((id, idx) => {
                console.log(`  ${idx + 1}. ${id} (type: ${id.constructor.name})`);
            });

            // Convert string IDs to ObjectId
            const objectIds = dateTemplate.subDataIds.map(id => {
                if (typeof id === 'string') {
                    try {
                        return new ObjectId(id);
                    } catch (e) {
                        console.warn(`  ⚠️ Cannot convert "${id}" to ObjectId: ${e.message}`);
                        return null;
                    }
                }
                return id instanceof ObjectId ? id : null;
            }).filter(id => id !== null);

            console.log(`\n  Converted ${objectIds.length} IDs to ObjectId`);

            // Find sub-templates by _id
            const subTemplates = await collection.find({
                _id: { $in: objectIds }
            }).toArray();

            console.log(`  ✅ Found ${subTemplates.length} sub-templates`);
            subTemplates.forEach(t => {
                console.log(`     - ${t.label || t.name || 'NO_LABEL'} (_id: ${t._id}, id: ${t.id || 'NO_ID'})`);
            });

            subData = subTemplates;
        }

        console.log('\n📋 Sub-data found:', subData.length);
        subData.forEach((sub, idx) => {
            console.log(`  ${idx + 1}. ${sub.label || sub.name} (id: ${sub.id || sub._id})`);
        });

        // Build correct subDataMapping
        const correctSubDataMapping = {};
        subData.forEach((sub) => {
            // ✅ FIXED: Use _id.toString() as key (matching the contract structure)
            const subId = sub._id.toString();
            const label = sub.label || sub.name || '';
            const labelLower = String(label).toLowerCase();

            // Map label to canonicalKey
            let canonicalKey = 'generic';
            if (labelLower.includes('day') || labelLower.includes('giorno')) {
                canonicalKey = 'day';
            } else if (labelLower.includes('month') || labelLower.includes('mese') || labelLower.includes('mes')) {
                canonicalKey = 'month';
            } else if (labelLower.includes('year') || labelLower.includes('anno') || labelLower.includes('ano')) {
                canonicalKey = 'year';
            }

            correctSubDataMapping[subId] = {
                canonicalKey,
                label: String(label),
                type: sub.type || 'number'
            };

            console.log(`  ✅ Mapped: ${label} (${subId.substring(0, 20)}...) → canonicalKey: "${canonicalKey}"`);
        });

        console.log('\n✅ New subDataMapping:', JSON.stringify(correctSubDataMapping, null, 2));

        // Update contract in DB
        if (!dateTemplate.nlpContract) {
            console.error('❌ Template has no nlpContract to update!');
            return;
        }

        const updatedContract = {
            ...dateTemplate.nlpContract,
            subDataMapping: correctSubDataMapping
        };

        const result = await collection.updateOne(
            { $or: [{ id: dateTemplate.id }, { _id: dateTemplate._id }] },
            { $set: { nlpContract: updatedContract } }
        );

        console.log('\n✅ Contract updated in DB:', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        });

        // Verify update
        const updated = await collection.findOne({ name: 'Date' });
        console.log('\n🔍 Verification - Updated subDataMapping:');
        Object.entries(updated.nlpContract.subDataMapping).forEach(([id, mapping]) => {
            console.log(`  ${id.substring(0, 30)}... → canonicalKey: "${mapping.canonicalKey}", label: "${mapping.label}"`);
        });

        console.log('\n🎉 Done! Restart the app to reload the template with correct contract.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

fixDateContract().catch(console.error);

