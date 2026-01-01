export interface EscalationColorConfig {
  border: string;
  fore: string;
  background: string;
}

export const ESCALATION_COLORS: { [key: string]: EscalationColorConfig } = {
  'non ho sentito': {
    border: '#bbb',      // argento
    fore: '#bbb',
    background: '#f3f4f6'
  },
  'deve confermare': {
    border: '#fbbf24',   // giallo
    fore: '#fbbf24',
    background: 'rgba(251,191,36,0.10)'
  },
  // ...altri tipi...
  'default': {
    border: '#ef4444',   // rosso
    fore: '#ef4444',
    background: 'rgba(239,68,68,0.10)'
  }
}; 