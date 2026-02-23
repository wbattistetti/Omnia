"""
Script: Verifica se ci sono ancora task di tipo 3 e embeddings nel database Factory
"""

import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db')
DB_FACTORY = 'factory'

def verify_type3_cleanup():
    client = None
    try:
        print('🔄 Connessione a MongoDB...')
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
        client.admin.command('ping')  # Test connection
        print('✅ Connesso a MongoDB\n')

        factory_db = client[DB_FACTORY]
        tasks_collection = factory_db['tasks']
        embeddings_collection = factory_db['embeddings']

        # 1. Verifica task di tipo 3
        print('🔍 Verifica task di tipo 3...')
        type3_tasks = list(tasks_collection.find({'type': 3}))
        type3_count = tasks_collection.count_documents({'type': 3})

        print(f'📋 Trovati {type3_count} task di tipo 3 (UtteranceInterpretation)')

        if type3_tasks:
            print('\n⚠️  Task di tipo 3 ancora presenti:')
            for index, task in enumerate(type3_tasks[:10], 1):
                task_id = task.get('id') or str(task.get('_id', 'N/A'))
                task_label = task.get('label', 'N/A')
                print(f'  {index}. ID: {task_id} - Label: "{task_label}"')
            if len(type3_tasks) > 10:
                print(f'  ... e altri {len(type3_tasks) - 10} task')
        else:
            print('✅ Nessun task di tipo 3 trovato nel database')

        # 2. Estrai ID dei task di tipo 3 (se presenti)
        task_ids = []
        for task in type3_tasks:
            task_id = task.get('id') or str(task.get('_id', ''))
            if task_id:
                task_ids.append(task_id)

        # 3. Verifica embeddings associati ai task di tipo 3
        print('\n🔍 Verifica embeddings associati ai task di tipo 3...')
        corresponding_embeddings = []
        if task_ids:
            corresponding_embeddings = list(embeddings_collection.find({
                'id': {'$in': task_ids},
                'type': 'task'
            }))
        corresponding_embeddings_count = len(corresponding_embeddings)

        print(f'📋 Trovati {corresponding_embeddings_count} embedding associati ai task di tipo 3')

        if corresponding_embeddings:
            print('\n⚠️  Embeddings ancora presenti:')
            for index, emb in enumerate(corresponding_embeddings[:10], 1):
                emb_id = emb.get('id', 'N/A')
                emb_type = emb.get('type', 'N/A')
                print(f'  {index}. ID: {emb_id} - Type: {emb_type}')
            if len(corresponding_embeddings) > 10:
                print(f'  ... e altri {len(corresponding_embeddings) - 10} embedding')
        else:
            print('✅ Nessun embedding associato ai task di tipo 3')

        # 4. Verifica tutti gli embedding di tipo 'task' (potrebbero essere orfani)
        print('\n🔍 Verifica tutti gli embedding di tipo "task"...')
        all_task_embeddings_count = embeddings_collection.count_documents({'type': 'task'})

        print(f'📋 Trovati {all_task_embeddings_count} embedding di tipo "task" nel database')

        if all_task_embeddings_count > corresponding_embeddings_count:
            orphan_count = all_task_embeddings_count - corresponding_embeddings_count
            print(f'⚠️  Attenzione: {orphan_count} embedding di tipo "task" potrebbero essere orfani (non associati a task di tipo 3)')

        # 5. Report finale
        print('\n📊 REPORT FINALE:')
        print('─' * 50)
        if type3_count == 0 and corresponding_embeddings_count == 0:
            print('✅ PULIZIA COMPLETA:')
            print('   - Nessun task di tipo 3 nel database')
            print('   - Nessun embedding associato ai task di tipo 3')
            if all_task_embeddings_count > 0:
                print(f'   ⚠️  Nota: {all_task_embeddings_count} embedding di tipo "task" presenti, ma non associati a task di tipo 3')
        else:
            print('❌ PULIZIA INCOMPLETA:')
            if type3_count > 0:
                print(f'   - {type3_count} task di tipo 3 ancora presenti')
            if corresponding_embeddings_count > 0:
                print(f'   - {corresponding_embeddings_count} embedding associati ai task di tipo 3 ancora presenti')
            print('\n   Per completare la pulizia, esegui:')
            print('   node backend/scripts/cleanAllType3TasksAndEmbeddings.js --confirm')
        print('─' * 50)

    except Exception as e:
        print(f'❌ ERRORE: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if client:
            client.close()
            print('\n✅ Connessione chiusa')

if __name__ == '__main__':
    verify_type3_cleanup()
