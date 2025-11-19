const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const dbFactory = 'factory';

async function diagnoseDateSubData() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(dbFactory);
        const collection = db.collection('Task_Templates');

        // 1. Find Date template
        const dateTemplate = await collection.findOne({ name: 'Date' });
        if (!dateTemplate) {
            console.error('❌ Template "Date" not found');
            return;
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 1: Date Template Structure');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Date Template:');
        console.log('  _id:', dateTemplate._id);
        console.log('  id:', dateTemplate.id);
        console.log('  name:', dateTemplate.name);
        console.log('  label:', dateTemplate.label);
        console.log('  has subData:', 'subData' in dateTemplate);
        console.log('  has subDataIds:', 'subDataIds' in dateTemplate);

        // 2. Inspect subDataIds in detail
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('STEP 2: subDataIds Analysis');
        console.log('═══════════════════════════════════════════════════════════');
        
        if (dateTemplate.subDataIds && Array.isArray(dateTemplate.subDataIds)) {
            console.log(`Found ${dateTemplate.subDataIds.length} subDataIds:\n`);
            
            dateTemplate.subDataIds.forEach((id, idx) => {
                console.log(`  [${idx + 1}] Value:`, id);
                console.log(`      Type: ${id.constructor.name}`);
                console.log(`      Is ObjectId? ${id instanceof ObjectId}`);
                console.log(`      String representation: "${String(id)}"`);
                console.log(`      toString(): "${id.toString()}"`);
                if (id instanceof ObjectId) {
                    console.log(`      ObjectId hex: "${id.toHexString()}"`);
                }
                console.log('');
            });
        } else {
            console.log('  ❌ subDataIds is not an array or does not exist');
            console.log('  subDataIds value:', dateTemplate.subDataIds);
            console.log('  subDataIds type:', typeof dateTemplate.subDataIds);
        }

        // 3. Try ALL possible search strategies
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 3: Search Strategies');
        console.log('═══════════════════════════════════════════════════════════');

        if (!dateTemplate.subDataIds || !Array.isArray(dateTemplate.subDataIds)) {
            console.log('  ❌ Cannot search: subDataIds is not an array');
            return;
        }

        // Strategy 1: Search by _id (ObjectId)
        console.log('\n🔍 Strategy 1: Find by _id (as ObjectId)...');
        try {
            const subTemplates1 = await collection.find({
                _id: { $in: dateTemplate.subDataIds }
            }).toArray();
            console.log(`  ✅ Found ${subTemplates1.length} templates`);
            subTemplates1.forEach(t => {
                console.log(`     - ${t.name || 'NO_NAME'} (_id: ${t._id}, id: ${t.id || 'NO_ID'})`);
            });
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }

        // Strategy 2: Convert to ObjectId if they're strings
        console.log('\n🔍 Strategy 2: Convert strings to ObjectId and search...');
        try {
            const objectIds = dateTemplate.subDataIds.map(id => {
                if (typeof id === 'string') {
                    try {
                        return new ObjectId(id);
                    } catch (e) {
                        return null;
                    }
                }
                return id instanceof ObjectId ? id : null;
            }).filter(id => id !== null);

            if (objectIds.length > 0) {
                const subTemplates2 = await collection.find({
                    _id: { $in: objectIds }
                }).toArray();
                console.log(`  ✅ Found ${subTemplates2.length} templates`);
                subTemplates2.forEach(t => {
                    console.log(`     - ${t.name || 'NO_NAME'} (_id: ${t._id}, id: ${t.id || 'NO_ID'})`);
                });
            } else {
                console.log('  ❌ Could not convert any IDs to ObjectId');
            }
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }

        // Strategy 3: Search by id field (GUID string)
        console.log('\n🔍 Strategy 3: Find by id field (GUID string)...');
        try {
            const stringIds = dateTemplate.subDataIds.map(id => String(id));
            const subTemplates3 = await collection.find({
                id: { $in: stringIds }
            }).toArray();
            console.log(`  ✅ Found ${subTemplates3.length} templates`);
            subTemplates3.forEach(t => {
                console.log(`     - ${t.name || 'NO_NAME'} (_id: ${t._id}, id: ${t.id || 'NO_ID'})`);
            });
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }

        // Strategy 4: Search by name (Day, Month, Year)
        console.log('\n🔍 Strategy 4: Find by name (Day, Month, Year)...');
        try {
            const subTemplates4 = await collection.find({
                name: { $in: ['Day', 'Month', 'Year', 'day', 'month', 'year'] }
            }).toArray();
            console.log(`  ✅ Found ${subTemplates4.length} templates`);
            subTemplates4.forEach(t => {
                console.log(`     - ${t.name} (_id: ${t._id}, id: ${t.id || 'NO_ID'})`);
            });
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }

        // Strategy 5: Search ALL templates and show their _id and id
        console.log('\n🔍 Strategy 5: Show ALL templates in collection (for reference)...');
        try {
            const allTemplates = await collection.find({}).limit(20).toArray();
            console.log(`  Total templates in collection: ${await collection.countDocuments()}`);
            console.log(`  Showing first 20:\n`);
            allTemplates.forEach((t, idx) => {
                console.log(`  [${idx + 1}] ${t.name || 'NO_NAME'}`);
                console.log(`      _id: ${t._id}`);
                console.log(`      id: ${t.id || 'NO_ID'}`);
                console.log(`      label: ${t.label || 'NO_LABEL'}`);
                console.log('');
            });
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }

        // 4. Check if subDataIds match any existing template IDs
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('STEP 4: Cross-Reference Check');
        console.log('═══════════════════════════════════════════════════════════');
        
        const allTemplatesForCheck = await collection.find({}).toArray();
        const allIds = new Set();
        const allObjectIds = new Set();
        
        allTemplatesForCheck.forEach(t => {
            if (t._id) allObjectIds.add(t._id.toString());
            if (t.id) allIds.add(String(t.id));
        });

        console.log(`Total templates in DB: ${allTemplatesForCheck.length}`);
        console.log(`Unique _id values: ${allObjectIds.size}`);
        console.log(`Unique id (GUID) values: ${allIds.size}\n`);

        dateTemplate.subDataIds.forEach((subId, idx) => {
            const subIdStr = String(subId);
            const subIdObjIdStr = subId instanceof ObjectId ? subId.toString() : null;
            
            const matchesById = subIdStr && allIds.has(subIdStr);
            const matchesByObjectId = subIdObjIdStr && allObjectIds.has(subIdObjIdStr);
            
            console.log(`  subDataIds[${idx}]: ${subId}`);
            console.log(`    Matches by id (GUID)? ${matchesById ? '✅ YES' : '❌ NO'}`);
            console.log(`    Matches by _id (ObjectId)? ${matchesByObjectId ? '✅ YES' : '❌ NO'}`);
        });

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('DIAGNOSIS COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Fatal Error:', error);
        console.error(error.stack);
    } finally {
        await client.close();
    }
}

diagnoseDateSubData().catch(console.error);

