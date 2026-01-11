/**
 * Determina il colore dell'icona per Tasks con mode="DataRequest"
 * basato sulla presenza di DDT e stato del test
 */
export function getTaskIconColor(task: any): string {
  // Solo per Tasks con mode="DataRequest"
  if (task.mode !== 'DataRequest') {
    return task.foregroundColor || '#22c55e'; // Colore normale
  }

  // Senza DDT = grigio
  if (!task.ddtId) {
    return '#6b7280'; // Grigio
  }

  // Con DDT ma test non passato = giallo
  if (task.testPassed !== true) {
    return '#eab308'; // Giallo
  }

  // Con DDT e test passato = colore originale del Task
  return task.foregroundColor || '#22c55e';
}
