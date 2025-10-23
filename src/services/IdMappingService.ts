import { generateId } from '../utils/idGenerator';

/**
 * Service per mappare gli ID backend in UUID frontend
 * Soluzione temporanea fino alla migrazione completa a UUID
 */
class IdMappingService {
    private backendToFrontendMap = new Map<string, string>();
    private frontendToBackendMap = new Map<string, string>();

    /**
     * Mappa un ID backend a un UUID frontend
     */
    mapBackendToFrontend(backendId: string): string {
        if (!backendId || backendId.length < 12) return generateId();

        // Se già mappato, restituisci l'UUID corrispondente
        if (this.backendToFrontendMap.has(backendId)) {
            return this.backendToFrontendMap.get(backendId)!;
        }

        // Altrimenti crea nuovo mapping
        const frontendId = generateId();
        this.backendToFrontendMap.set(backendId, frontendId);
        this.frontendToBackendMap.set(frontendId, backendId);

        console.log('✅ [IdMapping] Created mapping', { backendId, frontendId });
        return frontendId;
    }

    /**
     * Recupera l'ID backend da un UUID frontend
     */
    getBackendId(frontendId: string): string | undefined {
        return this.frontendToBackendMap.get(frontendId);
    }

    /**
     * Recupera l'UUID frontend da un ID backend
     */
    getFrontendId(backendId: string): string | undefined {
        return this.backendToFrontendMap.get(backendId);
    }

    /**
     * Pulisce tutti i mapping (per testing)
     */
    clearMappings(): void {
        this.backendToFrontendMap.clear();
        this.frontendToBackendMap.clear();
        console.log('✅ [IdMapping] Cleared all mappings');
    }
}

// Esporta un'istanza singleton del service
export const idMappingService = new IdMappingService();
