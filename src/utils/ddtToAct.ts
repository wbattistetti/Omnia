import type { ActMeta } from '../components/ActEditor/EditorHost/types';

/**
 * Converte un DDT in un ActMeta per usarlo con ActEditor context.
 * Questo permette di unificare l'apertura degli editor usando solo ctx.act.
 */
export function ddtToAct(ddt: any): ActMeta {
    if (!ddt) {
        throw new Error('DDT cannot be null or undefined');
    }

    return {
        id: ddt.id || ddt._id || `ddt_${Math.random().toString(36).slice(2)}`,
        type: 'DataRequest', // Tipo standard per DDT
        label: ddt.label || ddt._userLabel || 'Data',
        instanceId: ddt.instanceId || ddt.id || ddt._id, // Usa DDT id come instanceId se non presente
    };
}

