/**
 * Determina il colore dell'icona per Agent Acts con mode="DataRequest"
 * basato sulla presenza di DDT e stato del test
 */
export function getAgentActIconColor(agentAct: any): string {
  // Solo per Agent Acts con mode="DataRequest"
  if (agentAct.mode !== 'DataRequest') {
    return agentAct.foregroundColor || '#22c55e'; // Colore normale
  }
  
  // Senza DDT = grigio
  if (!agentAct.ddtId) {
    return '#6b7280'; // Grigio
  }
  
  // Con DDT ma test non passato = giallo
  if (agentAct.testPassed !== true) {
    return '#eab308'; // Giallo
  }
  
  // Con DDT e test passato = colore originale dell'Act
  return agentAct.foregroundColor || '#22c55e';
}
