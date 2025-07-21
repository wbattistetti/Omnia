# ActEditor

Componente React modulare per la visualizzazione e gestione delle azioni drag & drop.

## Struttura della cartella

- `ActEditor.tsx` — Componente principale (layout e orchestrazione)
- `ActionList.tsx` — Visualizzazione e gestione della lista delle azioni
- `ActionItem.tsx` — Sotto-componente per la singola azione (drag & drop)
- `types.ts` — Tipi e interfacce TypeScript
- `ActEditor.module.css` — Stili CSS module per il layout principale
- `ActionItem.module.css` — Stili CSS module per ActionItem
- `README.md` — Documentazione

## Utilizzo

```tsx
import ActEditor from './components/ActEditor';

function App() {
  return <ActEditor />;
}
```

## Personalizzazione
- Puoi modificare la lista delle azioni, le icone e i colori personalizzando i rispettivi file.
- Il componente è pensato per essere facilmente esportabile: basta copiare l'intera cartella `ActEditor` in un altro progetto React/TypeScript.

## Dipendenze
- React
- [lucide-react](https://lucide.dev/icons/) (per le icone)

## Note
- Ogni micro-file ha una responsabilità chiara.
- Gli stili sono separati tramite CSS module per massima portabilità.
- La tipizzazione è rigorosa per facilitare la manutenzione e l'autocompletamento. 