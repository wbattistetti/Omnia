import { v4 as uuidv4 } from 'uuid';
import type { ProblemIntent } from '../types/project';
import { generateId } from '../utils/idGenerator';

const API_BASE = ''; // Usa la stessa base URL degli altri servizi

/**
 * Rappresenta un'istanza di un Agent Act con intents personalizzati
 */
export interface ActInstance {
    instanceId: string;           // ID unico dell'istanza
    actId: string;                // Riferimento al template nel catalogo
    problemIntents: ProblemIntent[]; // Intents personalizzati di questa istanza
    ddt?: any;                    // DDT associato a questa istanza (se esiste)
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

        // Salva automaticamente nel database
        this.saveInstanceToDatabase(instance).catch(error => {
            console.error('Failed to save instance to database:', error);
        });

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

        // Salva automaticamente nel database
        this.saveInstanceToDatabase(instance).catch(error => {
            console.error('Failed to save instance to database:', error);
        });

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
            console.log('❌ [InstanceRepository] getInstance: ISTANZA NON TROVATA', {
                instanceId,
                availableInstances: Array.from(this.instances.keys())
            });
        } else {
            console.log('✅ [InstanceRepository] getInstance: ISTANZA TROVATA', {
                instanceId,
                hasDDT: !!instance.ddt,
                ddtMainData: instance.ddt?.mainData?.length || 0
            });
        }

        return instance;
    }

    /**
     * Aggiorna il DDT di un'istanza
     * @param instanceId ID dell'istanza da aggiornare
     * @param ddt DDT da associare all'istanza
     * @returns True se aggiornato con successo, false altrimenti
     */
    updateDDT(instanceId: string, ddt: any): boolean {
        console.log('📦 [InstanceRepository] updateDDT chiamato', {
            instanceId,
            ddtProvided: !!ddt,
            ddtMainData: ddt?.mainData?.length || 0
        });

        const instance = this.getInstance(instanceId);

        if (instance) {
            instance.ddt = ddt;
            instance.updatedAt = new Date();

            // Salva automaticamente nel database
            this.updateInstanceInDatabase(instance).catch(error => {
                console.error('Failed to update instance in database:', error);
            });

            console.log('✅ [InstanceRepository] DDT SALVATO con successo', {
                instanceId,
                ddtId: ddt?.id || ddt?._id,
                ddtLabel: ddt?.label,
                ddtMainData: ddt?.mainData?.length || 0
            });

            return true;
        }

        console.error('❌ [InstanceRepository] ISTANZA NON TROVATA per instanceId:', instanceId);
        console.log('📦 [InstanceRepository] Istanze disponibili:', Array.from(this.instances.keys()));
        return false;
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

    /**
     * Salva un'istanza nel database
     * @param instance L'istanza da salvare
     * @returns True se salvata con successo, false altrimenti
     */
    async saveInstanceToDatabase(instance: ActInstance): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE}/api/instances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(instance)
            });

            if (response.ok) {
                console.log('✅ [InstanceRepository] Instance saved to database:', instance.instanceId);
                return true;
            } else {
                console.error('❌ [InstanceRepository] Failed to save instance:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ [InstanceRepository] Error saving instance:', error);
            return false;
        }
    }

    /**
     * Carica tutte le istanze dal database
     * @returns True se caricate con successo, false altrimenti
     */
    async loadInstancesFromDatabase(): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE}/api/instances`);

            if (response.ok) {
                const instances: ActInstance[] = await response.json();

                // Pulisce le istanze esistenti e carica quelle dal database
                this.instances.clear();
                instances.forEach(instance => {
                    // Converte le date da stringa a Date
                    instance.createdAt = new Date(instance.createdAt);
                    instance.updatedAt = new Date(instance.updatedAt);
                    this.instances.set(instance.instanceId, instance);
                });

                console.log('✅ [InstanceRepository] Loaded instances from database:', instances.length);
                return true;
            } else {
                console.error('❌ [InstanceRepository] Failed to load instances:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ [InstanceRepository] Error loading instances:', error);
            return false;
        }
    }

    /**
     * Aggiorna un'istanza nel database
     * @param instance L'istanza da aggiornare
     * @returns True se aggiornata con successo, false altrimenti
     */
    async updateInstanceInDatabase(instance: ActInstance): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE}/api/instances/${instance.instanceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(instance)
            });

            if (response.ok) {
                console.log('✅ [InstanceRepository] Instance updated in database:', instance.instanceId);
                return true;
            } else {
                console.error('❌ [InstanceRepository] Failed to update instance:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ [InstanceRepository] Error updating instance:', error);
            return false;
        }
    }
}

// Esporta un'istanza singleton del repository
export const instanceRepository = new InstanceRepository();
