def get_adapt_prompts_prompt(original_texts: list[str], context_label: str, template_label: str, locale: str) -> str:
    """
    Generate prompt for adapting template prompts to a new context.

    Args:
        original_texts: List of original prompt texts from template
        context_label: New context label (e.g., "Chiedi la data di nascita del paziente")
        template_label: Original template label (e.g., "Date")
        locale: Language code (e.g., "it", "en", "pt")
    """
    lang_names = {
        "it": "Italian",
        "en": "English",
        "pt": "Portuguese"
    }
    lang_name = lang_names.get(locale.lower(), "the same language")

    # ✅ Normalizza context_label: rimuovi verbi all'imperativo e mantieni solo la descrizione
    # Es: "Chiedi la data di nascita del paziente" -> "data di nascita del paziente"
    normalized_context = context_label.lower().strip()
    # Rimuovi verbi comuni all'inizio
    verbs_to_remove = ["chiedi", "richiedi", "domanda", "acquisisci", "raccogli", "invita", "ask", "request", "collect", "tell", "give"]
    for verb in verbs_to_remove:
        if normalized_context.startswith(verb + " "):
            normalized_context = normalized_context[len(verb) + 1:].strip()
            break
    # Rimuovi articoli all'inizio se presenti
    articles = ["la", "il", "lo", "le", "gli", "the", "a", "an"]
    for article in articles:
        if normalized_context.startswith(article + " "):
            normalized_context = normalized_context[len(article) + 1:].strip()
            break

    texts_list = "\n".join([f"{i+1}. {text}" for i, text in enumerate(original_texts)])

    prompt = f"""You are a dialogue designer assistant. Your task is to adapt template prompts to ask for specific data in a natural, conversational way.

CONTEXT:
- Template label: "{template_label}"
- Data to ask for: "{normalized_context}"
- Language: {lang_name}

ORIGINAL TEMPLATE PROMPTS (to adapt - preserve order):
{texts_list}

TASK:
Transform each prompt to ask for "{normalized_context}" instead of the generic template data.

CRITICAL REPLACEMENT RULES:
1. Remove ALL possessive pronouns and replace with the specific context "{normalized_context}":
   - "sua data" / "suo dato" / "sue date" / "suoi dati" → "{normalized_context}" (remove possessive, add context)
   - "your date" / "their data" / "his date" / "her data" → "{normalized_context}" (remove possessive, add context)
   - "la sua data" → "la {normalized_context}" (remove possessive, keep article, add context)
   - "il suo dato" → "il {normalized_context}" (remove possessive, keep article, add context)

2. Replace generic data references with the specific context "{normalized_context}":
   - "la data" → "la {normalized_context}"
   - "il dato" → "il {normalized_context}"
   - "the date" → "the {normalized_context}"
   - "the data" → "the {normalized_context}"

3. PRESERVE the grammatical form, structure, and style of the original:
   - If the original is interrogative, keep it interrogative.
   - If it is imperative, keep it imperative.
   - If it is elliptical ("Che data?"), keep it elliptical (do NOT expand to full form).
   - If it uses a courtesy form, keep the courtesy form.

4. Do NOT add new words, modifiers, or temporal references (e.g., "ieri", "oggi", "yesterday", "today") unless they appear in the original.

5. Do NOT change the question or command format:
   - If the original starts with "Qual è…?", keep "Qual è…?".
   - If the original starts with "Inserisci…", keep "Inserisci…".
   - If the original starts with "Mi dica…", keep "Mi dica…".

6. Do NOT add verbs like "Chiedi", "Dimmi", "Per favore" unless they were in the original.

7. Do NOT add any words that were not in the original prompt.

8. PRESERVE THE EXACT ORDER: Return adapted prompts in the same order as the original list.

DETAILED EXAMPLES (correct replacements):
- Original: "Mi dica la sua data di nascita" + Context: "data di nascita del paziente"
  → "Mi dica la data di nascita del paziente" (remove "sua", keep "la", add "del paziente")

- Original: "Qual è la data?" + Context: "data di nascita del paziente"
  → "Qual è la data di nascita del paziente?" (replace "la data" with "la data di nascita del paziente")

- Original: "Che data?" + Context: "data di nascita del paziente"
  → "Che data di nascita del paziente?" (KEEP elliptical form, just replace "data" with "data di nascita del paziente")

- Original: "What is your date of birth?" + Context: "date of birth of the patient"
  → "What is the date of birth of the patient?" (remove "your", add "of the patient")

- Original: "Inserisci la data" + Context: "data di nascita del paziente"
  → "Inserisci la data di nascita del paziente" (replace "la data" with "la data di nascita del paziente")

- Original: "Mi dica il suo nome" + Context: "nome del paziente"
  → "Mi dica il nome del paziente" (remove "suo", keep "il", add "del paziente")

⚠️ CRITICAL:
- Return EXACTLY the same number of prompts as the input, in the same order.
- Each adapted prompt must correspond to the original prompt at the same position.
- Return ONLY a JSON array of strings: ["adapted1", "adapted2", ...]
- No markdown, no code fences, no explanations, no comments.
- Just the JSON array.

JSON array:"""

    return prompt
