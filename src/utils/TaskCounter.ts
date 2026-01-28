// src/utils/TaskCounter.ts
// Task Counter per calcolo ricorsivo delle percentuali di progresso

export interface TaskStatus {
    completed: boolean;
    timestamp?: Date;
}

export interface TaskProgress {
    totalTasks: number;
    completedTasks: number;
    percentage: number;
}

export interface FieldTaskProgress {
    fieldId: string;
    fieldLabel: string;
    fieldType: string;
    progress: TaskProgress;
    subFields?: FieldTaskProgress[];
}

// 🎯 TASK STANDARD per ogni tipo di dato
// ATTENZIONE: Nomi devono matchare esattamente con i tipi di step in WizardPipelineStep!
export const STANDARD_TASKS = {
    // Task per Main Data (ogni main data ha questi task)
    data: [
        'startPrompt',
        'noInputPrompts',
        'noMatchPrompts',
        'confirmationPrompts',
        'successPrompts'
    ],

    // Task per Sub Data (ogni sub data ha questi task)
    subTasks: [
        'startPrompt',
        'noInputPrompts',
        'noMatchPrompts',
        'confirmationPrompts',
        'successPrompts'
    ]
};

// 🎯 TASK COUNTER CLASS
export class TaskCounter {
    private taskStates: Record<string, Record<string, TaskStatus>> = {};

    // Inizializza i task per un campo
    initializeField(fieldId: string, fieldType: 'data' | 'subTasks'): void {
        const tasks = STANDARD_TASKS[fieldType];
        this.taskStates[fieldId] = {};

        tasks.forEach(task => {
            this.taskStates[fieldId][task] = {
                completed: false,
                timestamp: undefined
            };
        });
    }

    // Marca un task come completato
    completeTask(fieldId: string, taskName: string): void {
        if (!this.taskStates[fieldId]) {
            console.warn(`Field ${fieldId} not initialized`);
            return;
        }

        if (!this.taskStates[fieldId][taskName]) {
            console.warn(`Task ${taskName} not found for field ${fieldId}`);
            return;
        }

        this.taskStates[fieldId][taskName] = {
            completed: true,
            timestamp: new Date()
        };
    }

    // Calcola il progresso per un singolo campo
    calculateFieldProgress(fieldId: string): TaskProgress {
        if (!this.taskStates[fieldId]) {
            return { totalTasks: 0, completedTasks: 0, percentage: 0 };
        }

        const tasks = Object.values(this.taskStates[fieldId]);
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.completed).length;
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return { totalTasks, completedTasks, percentage };
    }

    // 🚀 CALCOLO RICORSIVO per Main Data + Sub Data
    calculateRecursiveProgress(
        data: any[],
        fieldProcessingStates?: Record<string, any>
    ): Record<string, number> {
        const progressMap: Record<string, number> = {};

        // Calcola progresso per ogni Main Data
        data.forEach((main, mainIndex) => {
            const mainFieldId = main.label || `main_${mainIndex}`;

            // Inizializza se non esiste
            if (!this.taskStates[mainFieldId]) {
                this.initializeField(mainFieldId, 'data');
            }

            // Calcola progresso Main Data
            const mainProgress = this.calculateFieldProgress(mainFieldId);

            // Calcola progresso Sub Data
            let subDataProgress = { totalTasks: 0, completedTasks: 0 };

            if (main.subTasks && main.subTasks.length > 0) {
                main.subTasks.forEach((sub: any, subIndex: number) => {
                    const subFieldId = `${mainFieldId}/${sub.label || `sub_${subIndex}`}`;

                    // Inizializza se non esiste
                    if (!this.taskStates[subFieldId]) {
                        this.initializeField(subFieldId, 'subTasks');
                    }

                    const subProgress = this.calculateFieldProgress(subFieldId);
                    subDataProgress.totalTasks += subProgress.totalTasks;
                    subDataProgress.completedTasks += subProgress.completedTasks;

                    // Salva progresso Sub Data
                    progressMap[subFieldId] = subProgress.percentage;
                });
            }

            // 🎯 FORMULA RICORSIVA: (Main tasks + Sub tasks) / (Main total + Sub total)
            const totalTasks = mainProgress.totalTasks + subDataProgress.totalTasks;
            const completedTasks = mainProgress.completedTasks + subDataProgress.completedTasks;
            const recursivePercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            progressMap[mainFieldId] = recursivePercentage;
        });

        // Calcola progresso root (aggregato di tutti i Main Data)
        const allMainProgress = data.map((main, index) => {
            const mainFieldId = main.label || `main_${index}`;
            return progressMap[mainFieldId] || 0;
        });

        const rootPercentage = allMainProgress.length > 0
            ? Math.round(allMainProgress.reduce((sum, p) => sum + p, 0) / allMainProgress.length)
            : 0;

        progressMap['__root__'] = rootPercentage;

        return progressMap;
    }

    // Simula completamento task per testing
    simulateTaskCompletion(fieldId: string, taskName: string, delay: number = 1000): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.completeTask(fieldId, taskName);
                resolve();
            }, delay);
        });
    }

    // Reset tutti i task
    resetAllTasks(): void {
        this.taskStates = {};
    }

    // Get stato di un task specifico
    getTaskStatus(fieldId: string, taskName: string): TaskStatus | null {
        return this.taskStates[fieldId]?.[taskName] || null;
    }

    // Get tutti i task di un campo
    getFieldTasks(fieldId: string): Record<string, TaskStatus> {
        return this.taskStates[fieldId] || {};
    }
}

// 🎯 SINGLETON INSTANCE
export const taskCounter = new TaskCounter();
