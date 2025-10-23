import { v4 as uuidv4 } from 'uuid';
import type { ProblemIntent } from '../types/project';
import { generateId } from '../utils/idGenerator';

/**
 * Rappresenta un'istanza di un Agent Act con intents personalizzati
 */
export interface ActInstance {
    instanceId: string;           // ID unico dell'istanza
    actId: string;                // Riferimento al template nel catalogo
    problemIntents: ProblemIntent[]; // Intents personalizzati di questa istanza
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Repository centrale per la gestione delle istanze degli acts
 * Mantiene una mappa di tutte le istanze create nel sistema
 */
class InstanceRepository {
    private instances = new Map<string, ActInstance>();

    /**
     * Crea una nuova istanza di AgentAct
     * @param actId ID del template dal catalogo
     * @param initialIntents Intents iniziali (opzionale, default dal template)
     * @param instanceId ID specifico per l'istanza (opzionale, se non fornito viene generato)
     * @returns La nuova istanza creata
     */
    createInstance(actId: string, initialIntents?: ProblemIntent[], instanceId?: string): ActInstance {
        const finalInstanceId = instanceId || generateId();

        const instance: ActInstance = {
            instanceId: finalInstanceId,
            actId,
            problemIntents: initialIntents || [], // Gli intents del template verranno aggiunti dopo
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.instances.set(finalInstanceId, instance);

        console.log('✅ [InstanceRepository] Created new instance:', {
            instanceId: finalInstanceId,
            actId,
            initialIntentsCount: initialIntents?.length || 0
        });

        return instance;
    }

    /**
     * Crea una nuova istanza con un ID specifico
     * Utile per migrare istanze esistenti o per sincronizzare con il backend
     * @param instanceId ID specifico da usare per l'istanza
     * @param actId ID del template dal catalogo
     * @param initialIntents Intents iniziali (opzionale)
     * @returns La nuova istanza creata
     */
    createInstanceWithId(instanceId: string, actId: string, initialIntents?: ProblemIntent[]): ActInstance {
        const instance: ActInstance = {
            instanceId,
            actId,
            problemIntents: initialIntents || [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.instances.set(instanceId, instance);

        console.log('✅ [InstanceRepository] Created instance with specific ID:', {
            instanceId,
            actId,
            initialIntentsCount: initialIntents?.length || 0
        });

        return instance;
    }

    /**
     * Recupera un'istanza per ID
     * @param instanceId ID dell'istanza da recuperare
     * @returns L'istanza trovata o undefined
     */
    getInstance(instanceId: string): ActInstance | undefined {
        const instance = this.instances.get(instanceId);

        if (!instance) {
            console.log('❌ [InstanceRepository] Instance not found:', instanceId);
        }

        return instance;
    }

    /**
     * Aggiorna gli intents di un'istanza
     * @param instanceId ID dell'istanza da aggiornare
     * @param intents Nuovi intents da impostare
     * @returns True se aggiornata con successo, false altrimenti
     */
    updateIntents(instanceId: string, intents: ProblemIntent[]): boolean {
        const instance = this.getInstance(instanceId);

        if (instance) {
            instance.problemIntents = intents;
            instance.updatedAt = new Date();

            console.log('✅ [InstanceRepository] Updated intents for instance:', {
                instanceId,
                intentsCount: intents.length
            });

            return true;
        }

        return false;
    }

    /**
     * Elimina un'istanza
     * @param instanceId ID dell'istanza da eliminare
     * @returns True se eliminata con successo, false altrimenti
     */
    deleteInstance(instanceId: string): boolean {
        const deleted = this.instances.delete(instanceId);

        if (deleted) {
            console.log('✅ [InstanceRepository] Deleted instance:', instanceId);
        } else {
            console.log('❌ [InstanceRepository] Instance not found for deletion:', instanceId);
        }

        return deleted;
    }

    /**
     * Restituisce tutte le istanze (per debugging)
     */
    getAllInstances(): ActInstance[] {
        return Array.from(this.instances.values());
    }

    /**
     * Pulisce tutte le istanze (per testing)
     */
    clearAll(): void {
        this.instances.clear();
        console.log('✅ [InstanceRepository] Cleared all instances');
    }
}

// Esporta un'istanza singleton del repository
export const instanceRepository = new InstanceRepository();
