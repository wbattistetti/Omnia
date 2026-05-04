# Espressioni di avanzamento SEND (JavaScript)

Il campo `dslExpression` contiene un’**unica espressione** valutata con `param` e `prev` in scope (vedi `advancementJsExpr.ts`).

## Tipo del parametro (`targetType` / firma)

| Tipo     | Cosa deve restituire l’espressione |
|----------|------------------------------------|
| **String** | Solo `typeof === 'string'` (usare `toISOString()`, `String()`, template literals, ecc.). |
| **Date**   | `Date`, numero (ms) o stringa ISO normalizzabile; Omnia converte a ISO calendario per il persist. |
| **Int**    | Numero intero finito. |
| **Number** | Numero finito. |

Se il tipo non coincide: **«Il risultato deve rispettare il tipo dichiarato (String, Date, Int, Number).»**

## Test (Play)

Dopo **Test**, per il parametro in editing compaiono **due chip**: **Precedente** (valore `prev`/contesto per quella chiave, bordo arancione) e **Nuovo** (risultato dell’espressione, bordo verde). Gli altri parametri non sono elencati. Il risultato del test viene **rimosso** se cambi la descrizione in linguaggio naturale, il codice in editor o i letterali SEND rilevanti.

Per ogni `param.x` usato nello script, la riga SEND corrispondente deve avere un **valore letterale** in griglia; altrimenti `param.x` manca in Test (es. `undefined` e errori su `Date`).

## Nomi in `param` e `prev` (internalName vs Campo API)

- Nello script, **`param.<chiave>`** e **`prev.<chiave>`** usano la **chiave tecnica** del parametro, non il nome del campo come in OpenAPI.
- In persistenza, ogni riga SEND ha `internalName`. In mapping, diventa `wireKey`; in valutazione, la chiave verso `param` è l’**ultimo segmento** del `wireKey` (se non ci sono punti, coincide con l’`internalName` intero). Vedi `paramFieldKeyFromWireKey` in `advancementQuickTest.ts` e `backendInputsToMappingEntries` in `backendCallMappingAdapter.ts`.
- La colonna **Campo API** (`apiParam`) è il nome **OpenAPI** (es. `startDate`). L’`internalName` è spesso uno **slug** (es. `start_date` da `slugInternalName`) o un nome rinominato dall’utente. **Non c’è traduzione automatica**: se lo script usa `param.startDate` ma la chiave interna è `start_date`, il valore è `undefined`.
- La firma passata all’IA (`backendParameterSignature.parameters`) è indicizzata per **`internalName`**: è la lista da cui copiare i nomi per `param.*`.

## IA

La traduzione NL→JS deve produrre solo il **corpo** dell’espressione, mai `nome = ...`, e deve essere **coerente col tipo** del parametro (vedi prompt backend). Usare **solo** le chiavi presenti in `parameters`, mai nomi API inventati.
