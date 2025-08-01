// sidebarTheme.ts
import { Bot, User, Database, GitBranch, CheckSquare, Layers } from 'lucide-react';

export const SIDEBAR_TYPE_COLORS = {
  agentActs: { main: '#8b5cf6', header: '#7c3aed', light: '#ede9fe' }, // viola
  userActs: { main: '#22c55e', header: '#16a34a', light: '#dcfce7' }, // verde
  backendActions: { main: '#0ea5e9', header: '#0369a1', light: '#e0f2fe' }, // blu
  conditions: { main: '#eab308', header: '#ca8a04', light: '#fef9c3' }, // giallo
  tasks: { main: '#f97316', header: '#ea580c', light: '#ffedd5' }, // arancione
  macrotasks: { main: '#ef4444', header: '#b91c1c', light: '#fee2e2' }, // rosso
};

export const SIDEBAR_FONT_SIZES = {
  macro: 1.4,      // Titolo macro (Agent Acts, ecc.)
  category: 1.1,   // Categoria (es: "Agent handles: ...")
  item: 1,         // Voce interna
  count: 0.8,      // Numero voci
  icon: 0.9,       // Icone
};

export const SIDEBAR_TYPE_ICONS = {
  agentActs: Bot,
  userActs: User,
  backendActions: Database,
  conditions: GitBranch,
  tasks: CheckSquare,
  macrotasks: Layers,
}; 