# ResponseEditor

Componente React modulare per la gestione e visualizzazione di flussi conversazionali ad albero.

## Struttura della cartella

- `ResponseEditor.tsx` — Componente principale (layout e orchestrazione)
- `TreeView.tsx` — Visualizzazione e gestione dell'albero dei nodi
- `TreeNode.tsx` — Nodo singolo dell'albero (drag & drop, rendering)
- `ToolbarButton.tsx` — Bottone riutilizzabile per la toolbar
- `icons.tsx` — Funzione per la mappatura delle icone
- `types.ts` — Tipi e interfacce TypeScript
- `useTreeNodes.ts` — Custom hook per la gestione dello stato dei nodi
- `README.md` — Documentazione

## Utilizzo

```tsx
import ResponseEditor from './components/ResponseEditor';

function App() {
  return <ResponseEditor />;
}
```

## Personalizzazione
- Puoi modificare la logica dei nodi, le azioni e le icone personalizzando i rispettivi file.
- Il componente è pensato per essere facilmente esportabile: basta copiare l'intera cartella `ResponseEditor` in un altro progetto React/TypeScript.

## Dipendenze
- React
- [lucide-react](https://lucide.dev/icons/) (per le icone)
- Tailwind CSS (opzionale, per gli stili)

## Note
- Ogni micro-file ha una responsabilità chiara.
- La logica di stato è separata dalla presentazione tramite custom hook.
- La tipizzazione è rigorosa per facilitare la manutenzione e l'autocompletamento. 