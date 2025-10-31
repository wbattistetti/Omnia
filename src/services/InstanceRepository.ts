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
                ddtType: typeof instance.ddt,
                ddtIsNull: instance.ddt === null,
                ddtIsUndefined: instance.ddt === undefined,
                ddtStringified: instance.ddt ? JSON.stringify(instance.ddt, null, 2).substring(0, 500) : 'null/undefined',
                ddtKeys: instance.ddt && typeof instance.ddt === 'object' ? Object.keys(instance.ddt) : [],
                ddtMainData: instance.ddt?.mainData,
                ddtMainDataLength: instance.ddt?.mainData?.length || 0,
                ddtId: instance.ddt?.id,
                instanceFull: instance // Log completo per debugging
            });
        }

        return instance;
    }

    /**
     * Aggiorna il DDT di un'istanza
     * @param instanceId ID dell'istanza da aggiornare
     * @param ddt DDT da associare all'istanza
     * @param projectId ID del progetto (opzionale, se fornito salva nel progetto specifico)
     * @returns True se aggiornato con successo, false altrimenti
     */
    updateDDT(instanceId: string, ddt: any, projectId?: string): boolean {
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
            this.updateInstanceInDatabase(instance, projectId).catch(error => {
                console.error('Failed to update instance in database:', error);
            });

            console.log('✅ [InstanceRepository] DDT SALVATO con successo', {
                instanceId,
                ddtId: ddt?.id || ddt?._id,
                ddtLabel: ddt?.label,
                ddtMainData: ddt?.mainData?.length || 0,
                projectId: projectId || 'global'
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
     * @param projectId ID del progetto (opzionale, se fornito salva nel progetto specifico)
     * @returns True se salvata con successo, false altrimenti
     */
    async saveInstanceToDatabase(instance: ActInstance, projectId?: string): Promise<boolean> {
        try {
            let url: string;
            let payload: any;

            if (projectId) {
                // Salva nel progetto specifico
                url = `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/instances`;
                // Il backend si aspetta { baseActId, mode, message, overrides, ddtSnapshot, rowId }
                payload = {
                    baseActId: instance.actId,
                    mode: 'DataRequest', // Default, dovrebbe essere determinato dal contesto
                    message: null,
                    overrides: null,
                    ddtSnapshot: instance.ddt || null,
                    rowId: instance.instanceId // ID originale della riga
                };

                console.log('💾 [InstanceRepository] Saving instance to DB:', {
                    instanceId: instance.instanceId,
                    projectId,
                    hasDDT: !!instance.ddt,
                    ddtType: typeof instance.ddt,
                    ddtMainDataLength: instance.ddt?.mainData?.length || 0,
                    ddtId: instance.ddt?.id,
                    ddtKeys: instance.ddt && typeof instance.ddt === 'object' ? Object.keys(instance.ddt) : [],
                    ddtSnapshotFull: instance.ddt // Log completo per vedere struttura
                });
            } else {
                // Fallback: usa endpoint globale (se esiste)
                url = `${API_BASE}/api/instances`;
                payload = instance;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`✅ [InstanceRepository] Instance saved to database: ${instance.instanceId}${projectId ? ` (project: ${projectId})` : ''}`);
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
     * @param projectId ID del progetto (opzionale, se fornito carica solo le istanze di quel progetto)
     * @returns True se caricate con successo, false altrimenti
     */
    async loadInstancesFromDatabase(projectId?: string): Promise<boolean> {
        try {
            let url = `${API_BASE}/api/instances`;
            if (projectId) {
                // Carica solo le istanze del progetto specifico
                url = `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/instances`;
            } else {
                // Endpoint globale non esiste o non è supportato
                // Non è un errore, semplicemente non ci sono istanze globali
                console.log('ℹ️ [InstanceRepository] Skipping global instances load (project-specific only)');
                return true;
            }

            const response = await fetch(url);

            if (response.ok) {
                let instances: ActInstance[];
                if (projectId) {
                    // Il backend restituisce { count, items } per progetti specifici
                    const data = await response.json();
                    instances = Array.isArray(data.items) ? data.items : [];
                } else {
                    // Il backend restituisce array diretto per /api/instances
                    instances = await response.json();
                }

                if (projectId) {
                    // Quando carichiamo un progetto specifico, puliamo solo le istanze e carichiamo quelle del progetto
                    this.instances.clear();
                } else {
                    // Quando carichiamo globalmente, puliamo tutto
                    this.instances.clear();
                }

                instances.forEach((instance: any) => {
                    // Usa rowId (ID originale della riga) se disponibile, altrimenti _id
                    // Questo permette di mappare correttamente le istanze alle righe del flowchart
                    const instanceId = instance.rowId || instance.instanceId || instance._id || String(instance._id);

                    // Debug: vediamo cosa arriva dal database
                    console.log('📥 [InstanceRepository] Loading instance from DB:', {
                        instanceId,
                        rawInstance: instance,
                        hasDDTSnapshot: !!instance.ddtSnapshot,
                        ddtSnapshotType: typeof instance.ddtSnapshot,
                        ddtSnapshotIsNull: instance.ddtSnapshot === null,
                        ddtSnapshotKeys: instance.ddtSnapshot && typeof instance.ddtSnapshot === 'object' ? Object.keys(instance.ddtSnapshot) : [],
                        ddtSnapshotMainDataLength: instance.ddtSnapshot?.mainData?.length || 0,
                        ddtSnapshotId: instance.ddtSnapshot?.id,
                        ddtSnapshotFull: instance.ddtSnapshot, // Log completo per vedere struttura
                        hasDDT: !!instance.ddt,
                        ddtType: typeof instance.ddt
                    });

                    const ddtValue = instance.ddtSnapshot || instance.ddt || null;

                    console.log('📦 [InstanceRepository] Final ddt value:', {
                        exists: !!ddtValue,
                        type: typeof ddtValue,
                        isNull: ddtValue === null,
                        keys: ddtValue && typeof ddtValue === 'object' ? Object.keys(ddtValue) : [],
                        mainDataLength: ddtValue?.mainData?.length || 0,
                        id: ddtValue?.id
                    });

                    const actInstance: ActInstance = {
                        instanceId,
                        actId: instance.baseActId || instance.actId || '',
                        problemIntents: instance.problemIntents || [],
                        ddt: ddtValue,
                        createdAt: instance.createdAt instanceof Date ? instance.createdAt : new Date(instance.createdAt),
                        updatedAt: instance.updatedAt instanceof Date ? instance.updatedAt : new Date(instance.updatedAt)
                    };
                    this.instances.set(instanceId, actInstance);
                    console.log(`💾 [InstanceRepository] Added instance to map:`, {
                        instanceId,
                        mapSize: this.instances.size,
                        allKeys: Array.from(this.instances.keys())
                    });
                });

                console.log(`✅ [InstanceRepository] Loaded ${instances.length} instances from database${projectId ? ` (project: ${projectId})` : ''}`);
                console.log(`📊 [InstanceRepository] Final map state:`, {
                    mapSize: this.instances.size,
                    allKeys: Array.from(this.instances.keys()),
                    allInstanceIds: Array.from(this.instances.values()).map(i => i.instanceId)
                });
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
     * Aggiorna un'istanza nel database (o la crea se non esiste)
     * @param instance L'istanza da aggiornare
     * @param projectId ID del progetto (opzionale, se fornito aggiorna nel progetto specifico)
     * @returns True se aggiornata/creata con successo, false altrimenti
     */
    async updateInstanceInDatabase(instance: ActInstance, projectId?: string): Promise<boolean> {
        try {
            if (projectId) {
                // Usa endpoint progetto-specifico
                const url = `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/instances/${instance.instanceId}`;
                const payload = {
                    message: null,
                    overrides: null,
                    ddtSnapshot: instance.ddt || null
                };

                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    console.log(`✅ [InstanceRepository] Instance updated in database: ${instance.instanceId} (project: ${projectId})`);
                    return true;
                } else if (response.status === 404) {
                    // Se l'istanza non esiste (404), creala con POST
                    console.log(`⚠️ [InstanceRepository] Instance not found, creating new one: ${instance.instanceId} (project: ${projectId})`);
                    return await this.saveInstanceToDatabase(instance, projectId);
                } else {
                    console.error('❌ [InstanceRepository] Failed to update instance:', response.statusText);
                    return false;
                }
            } else {
                // Fallback: usa endpoint globale (se esiste)
                const response = await fetch(`${API_BASE}/api/instances/${instance.instanceId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(instance)
                });

                if (response.ok) {
                    console.log('✅ [InstanceRepository] Instance updated in database:', instance.instanceId);
                    return true;
                } else if (response.status === 404) {
                    console.log('⚠️ [InstanceRepository] Instance not found, creating new one:', instance.instanceId);
                    return await this.saveInstanceToDatabase(instance);
                } else {
                    console.error('❌ [InstanceRepository] Failed to update instance:', response.statusText);
                    return false;
                }
            }
        } catch (error) {
            console.error('❌ [InstanceRepository] Error updating instance:', error);
            return false;
        }
    }

    /**
     * Salva tutte le istanze in memoria nel database (bulk save)
     * Utile quando si salva il progetto per sincronizzare tutto insieme
     * @param projectId ID del progetto (opzionale, se fornito salva nel progetto specifico)
     * @returns True se salvate con successo, false altrimenti
     */
    async saveAllInstancesToDatabase(projectId?: string): Promise<boolean> {
        try {
            const allInstances = Array.from(this.instances.values());
            if (allInstances.length === 0) {
                console.log('ℹ️ [InstanceRepository] No instances to save');
                return true;
            }

            console.log(`📦 [InstanceRepository] Saving ${allInstances.length} instances to database${projectId ? ` (project: ${projectId})` : ''}...`);

            // Salva tutte le istanze (crea quelle che non esistono, aggiorna quelle che esistono)
            const results = await Promise.allSettled(
                allInstances.map(instance => this.updateInstanceInDatabase(instance, projectId))
            );

            const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length;

            if (failed > 0) {
                console.warn(`⚠️ [InstanceRepository] Failed to save ${failed} out of ${allInstances.length} instances`);
            } else {
                console.log(`✅ [InstanceRepository] Successfully saved ${successful} instances to database`);
            }

            return failed === 0;
        } catch (error) {
            console.error('❌ [InstanceRepository] Error saving all instances:', error);
            return false;
        }
    }
}

// Esporta un'istanza singleton del repository
export const instanceRepository = new InstanceRepository();
