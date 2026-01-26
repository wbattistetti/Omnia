import DialogueTaskService from './DialogueTaskService';

export interface TemplateUpdateOptions {
  templateId: string;
  dataContract: any;
}

export interface CreateTemplateOptions {
  templateId: string;
  dataContract: any;
  newName: string;
  newLabel?: string;
}

/**
 * Aggiorna un template esistente con il nuovo dataContract
 * Aggiorna SOLO il template identificato da templateId
 */
export async function updateTemplateContract(
  options: TemplateUpdateOptions
): Promise<{ success: boolean; templateId: string; error?: string }> {
  const { templateId, dataContract } = options;

  try {
    // Carica template corrente
    const template = DialogueTaskService.getTemplate(templateId);
    if (!template) {
      return { success: false, templateId, error: 'Template non trovato' };
    }

    // Prepara update - aggiorna SOLO dataContract
    const updatePayload = {
      ...template,
      dataContract,
      updatedAt: new Date()
    };

    // Chiama API backend
    const response = await fetch(`/api/factory/task-templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Errore aggiornamento' }));
      return { success: false, templateId, error: error.message || 'Errore aggiornamento' };
    }

    // Invalida cache e ricarica
    await DialogueTaskService.loadTemplates();

    return { success: true, templateId };
  } catch (error: any) {
    return { success: false, templateId, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Crea un nuovo template duplicando quello esistente
 * Duplicazione semplice senza versioning complesso
 */
export async function createNewTemplateFrom(
  options: CreateTemplateOptions
): Promise<{ success: boolean; newTemplateId: string; error?: string }> {
  const { templateId, dataContract, newName, newLabel } = options;

  try {
    // Carica template originale
    const originalTemplate = DialogueTaskService.getTemplate(templateId);
    if (!originalTemplate) {
      return { success: false, newTemplateId: '', error: 'Template originale non trovato' };
    }

    // Genera nuovo ID
    const newId = `${templateId}-${Date.now()}`;

    // Crea nuovo template (duplicazione semplice)
    const newTemplate = {
      ...originalTemplate,
      _id: newId,
      id: newId,
      name: newName,
      label: newLabel || newName,
      dataContract,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Rimuovi _id se presente (MongoDB lo gestisce)
    delete (newTemplate as any)._id;

    // Salva via API
    const response = await fetch('/api/factory/dialogue-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTemplate)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Errore creazione' }));
      return { success: false, newTemplateId: '', error: error.message || 'Errore creazione' };
    }

    // Invalida cache e ricarica
    await DialogueTaskService.loadTemplates();

    return { success: true, newTemplateId: newId };
  } catch (error: any) {
    return { success: false, newTemplateId: '', error: error.message || 'Errore sconosciuto' };
  }
}
