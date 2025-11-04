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
    message?: { text: string };   // Messaggio testuale per atti non interattivi
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

        // Removed verbose logs

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
        const instance = this.getInstance(instanceId);

        if (instance) {
            instance.ddt = ddt;
            instance.updatedAt = new Date();

            // Salva automaticamente nel database
            this.updateInstanceInDatabase(instance, projectId).catch(error => {
                console.error('Failed to update instance in database:', error);
            });

            return true;
        }

        console.error('❌ [InstanceRepository] ISTANZA NON TROVATA per instanceId:', instanceId);
        return false;
    }

    /**
     * Aggiorna gli intents di un'istanza
     * @param instanceId ID dell'istanza da aggiornare
     * @param intents Nuovi intents da impostare
     * @returns True se aggiornata con successo, false altrimenti
     */
    updateIntents(instanceId: string, intents: ProblemIntent[]): boolean {
        console.log('[InstanceRepository][UPDATE_INTENTS][START]', {
            instanceId,
            intentsCount: intents.length,
            intents: intents.map(it => ({
                id: it.id,
                name: it.name,
                threshold: it.threshold,
                matchingCount: it.phrases?.matching?.length || 0,
                notMatchingCount: it.phrases?.notMatching?.length || 0,
                keywordsCount: it.phrases?.keywords?.length || 0
            }))
        });

        const instance = this.getInstance(instanceId);

        if (instance) {
            const oldIntentsCount = instance.problemIntents?.length || 0;
            instance.problemIntents = intents;
            instance.updatedAt = new Date();

            console.log('[InstanceRepository][UPDATE_INTENTS][SUCCESS]', {
                instanceId,
                oldIntentsCount,
                newIntentsCount: intents.length,
                instanceUpdatedAt: instance.updatedAt.toISOString(),
                note: 'Updated in memory - will be saved to DB when saveAllInstancesToDatabase() is called'
            });

            // Emit custom event to notify listeners (e.g., IntentListEditor) that intents were updated
            window.dispatchEvent(new CustomEvent('instanceRepository:updated', {
                detail: { instanceId, type: 'intents' }
            }));

            return true;
        }

        console.warn('[InstanceRepository][UPDATE_INTENTS][FAILED]', {
            instanceId,
            reason: 'Instance not found',
            availableInstances: Array.from(this.instances.keys()).slice(0, 5)
        });

        return false;
    }

    /**
     * Aggiorna il message di un'istanza
     * @param instanceId ID dell'istanza da aggiornare
     * @param message Messaggio da impostare
     * @returns True se aggiornata con successo, false altrimenti
     */
    updateMessage(instanceId: string, message: { text: string }): boolean {
        const instance = this.getInstance(instanceId);

        if (instance) {
            instance.message = message;
            instance.updatedAt = new Date();

            return true;
        }

        return false;
    }

    /**
     * Aggiorna un'istanza con valori parziali
     * @param instanceId ID dell'istanza da aggiornare
     * @param updates Campi da aggiornare
     * @returns True se aggiornata con successo, false altrimenti
     */
    updateInstance(instanceId: string, updates: Partial<ActInstance>): boolean {
        const instance = this.getInstance(instanceId);

        if (instance) {
            Object.assign(instance, updates);
            instance.updatedAt = new Date();

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

        // Removed verbose logs

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

                // Removed verbose log
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

                    const ddtValue = instance.ddtSnapshot || instance.ddt || null;

                    console.log('[InstanceRepository][LOAD]', {
                        dbId: instance._id,
                        rowId: instance.rowId,
                        instanceId: instance.instanceId,
                        finalInstanceId: instanceId,
                        mode: instance.mode,
                        baseActId: instance.baseActId,
                        hasMessage: !!instance.message,
                        messageText: instance.message?.text?.substring(0, 50) || 'N/A',
                        messageFull: instance.message ? JSON.stringify(instance.message) : 'null'
                    });

                    const actInstance: ActInstance = {
                        instanceId,
                        actId: instance.baseActId || instance.actId || '',
                        problemIntents: instance.problemIntents || [],
                        ddt: ddtValue,
                        message: instance.message || undefined,
                        createdAt: instance.createdAt instanceof Date ? instance.createdAt : new Date(instance.createdAt),
                        updatedAt: instance.updatedAt instanceof Date ? instance.updatedAt : new Date(instance.updatedAt)
                    };

                    this.instances.set(instanceId, actInstance);

                    console.log('[InstanceRepository][LOAD][STORED]', {
                        instanceId,
                        storedMessage: actInstance.message?.text?.substring(0, 50) || 'N/A',
                        storedMessageFull: actInstance.message ? JSON.stringify(actInstance.message) : 'undefined',
                        hasProblemIntents: !!actInstance.problemIntents,
                        problemIntentsCount: actInstance.problemIntents?.length || 0
                    });
                });

                // Removed verbose logs
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
            console.log('[InstanceRepository][UPDATE_IN_DB][START]', {
                instanceId: instance.instanceId,
                projectId,
                hasMessage: !!instance.message,
                messageText: instance.message?.text?.substring(0, 50) || 'N/A',
                hasDDT: !!instance.ddt,
                actId: instance.actId
            });

            if (projectId) {
                // Usa endpoint progetto-specifico
                const url = `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/instances/${instance.instanceId}`;
                // IMPORTANTE: passa instance.message se esiste, non null!
                // ✅ FIX: Includi anche problemIntents per salvare le frasi generate
                const payload = {
                    message: instance.message || null, // BUG FIX: era sempre null, ora passa il messaggio
                    overrides: null,
                    ddtSnapshot: instance.ddt || null,
                    problemIntents: instance.problemIntents || null, // ✅ Salva le frasi generate
                    mode: 'Message', // Aggiungi mode per istanze Message (se hanno messaggio)
                    baseActId: instance.actId || 'Message' // Aggiungi baseActId
                };

                // Log dettagliato del payload - espandi tutto per vedere esattamente cosa viene inviato
                console.log('[InstanceRepository][UPDATE_IN_DB][PAYLOAD]', {
                    instanceId: instance.instanceId,
                    projectId,
                    hasMessage: !!payload.message,
                    messageText: payload.message?.text || 'N/A',
                    messageObject: payload.message,
                    hasProblemIntents: !!payload.problemIntents,
                    problemIntentsCount: payload.problemIntents?.length || 0,
                    problemIntents: payload.problemIntents?.map((it: any) => ({
                        id: it.id,
                        name: it.name,
                        matchingCount: it.phrases?.matching?.length || 0,
                        notMatchingCount: it.phrases?.notMatching?.length || 0
                    })) || [],
                    mode: payload.mode,
                    baseActId: payload.baseActId,
                    hasDDT: !!payload.ddtSnapshot,
                    payloadComplete: payload
                });
                // Log anche come stringa JSON per vedere esattamente cosa viene inviato
                console.log('[InstanceRepository][UPDATE_IN_DB][PAYLOAD_JSON]', JSON.stringify(payload, null, 2));

                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json().catch(() => null);
                    // Log dettagliato del risultato - espandi tutto per vedere cosa viene salvato nel DB
                    console.log('[InstanceRepository][UPDATE_IN_DB][SUCCESS]', {
                        instanceId: instance.instanceId,
                        projectId,
                        result_id: result?._id,
                        result_rowId: result?.rowId,
                        result_mode: result?.mode,
                        result_baseActId: result?.baseActId,
                        result_hasMessage: !!result?.message,
                        result_messageText: result?.message?.text || 'N/A',
                        result_messageObject: result?.message,
                        result_complete: result
                    });
                    // Log anche come stringa JSON per vedere esattamente cosa viene salvato
                    if (result) {
                        console.log('[InstanceRepository][UPDATE_IN_DB][RESULT_JSON]', JSON.stringify(result, null, 2));
                    }
                    return true;
                } else if (response.status === 404) {
                    // Se l'istanza non esiste (404), creala con POST
                    console.log('[InstanceRepository][UPDATE_IN_DB][NOT_FOUND_CREATE]', {
                        instanceId: instance.instanceId,
                        projectId
                    });
                    return await this.saveInstanceToDatabase(instance, projectId);
                } else {
                    const errorText = await response.text().catch(() => response.statusText);
                    console.error('[InstanceRepository][UPDATE_IN_DB][FAILED]', {
                        instanceId: instance.instanceId,
                        projectId,
                        status: response.status,
                        statusText: response.statusText,
                        errorText: errorText.substring(0, 200)
                    });
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

            console.log('[InstanceRepository][SAVE_ALL][START]', {
                projectId,
                instancesCount: allInstances.length
            });

            // Log dettagliato di ogni istanza - espandi per vedere tutto
            allInstances.forEach((inst, idx) => {
                console.log(`[InstanceRepository][SAVE_ALL][INSTANCE_${idx}]`, {
                    instanceId: inst.instanceId,
                    actId: inst.actId,
                    hasMessage: !!inst.message,
                    messageText: inst.message?.text || 'N/A',
                    messageObject: inst.message,
                    hasDDT: !!inst.ddt,
                    instanceComplete: {
                        instanceId: inst.instanceId,
                        actId: inst.actId,
                        message: inst.message,
                        ddt: inst.ddt ? '[DDT present]' : null
                    }
                });
                // Log anche come JSON per vedere esattamente la struttura
                console.log(`[InstanceRepository][SAVE_ALL][INSTANCE_${idx}_JSON]`, JSON.stringify({
                    instanceId: inst.instanceId,
                    actId: inst.actId,
                    message: inst.message
                }, null, 2));
            });

            if (allInstances.length === 0) {
                console.log('ℹ️ [InstanceRepository] No instances to save');
                return true;
            }

            console.log(`📦 [InstanceRepository] Saving ${allInstances.length} instances to database${projectId ? ` (project: ${projectId})` : ''}...`);

            // Salva tutte le istanze (crea quelle che non esistono, aggiorna quelle che esistono)
            const results = await Promise.allSettled(
                allInstances.map(instance => {
                    console.log('[InstanceRepository][SAVE_ALL][SAVING_INSTANCE]', {
                        instanceId: instance.instanceId,
                        actId: instance.actId,
                        hasMessage: !!instance.message,
                        messageText: instance.message?.text?.substring(0, 50) || 'N/A'
                    });
                    return this.updateInstanceInDatabase(instance, projectId);
                })
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
