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

    texts_list = "\n".join([f"- {text}" for text in original_texts])

    prompt = f"""You are a dialogue designer assistant. Your task is to adapt template prompts to ask for specific data in a natural, conversational way.

CONTEXT:
- Template label: "{template_label}"
- Data to ask for: "{normalized_context}"
- Language: {lang_name}

ORIGINAL TEMPLATE PROMPTS (to adapt):
{texts_list}

TASK:
Transform each prompt to ask for "{normalized_context}" instead of the generic template data.

RULES:
1. Keep the same grammatical form, structure, and style as the original prompt.
   - If the original is interrogative, keep it interrogative.
   - If it is imperative, keep it imperative.
   - If it is elliptical ("Che data?"), keep it elliptical.
   - If it uses a courtesy form, keep the courtesy form.

2. Replace ONLY the generic reference to the data with the specific context: "{normalized_context}".

3. Use natural, conversational language in {lang_name}.

4. Do NOT add new words, modifiers, or temporal references (e.g., "ieri", "oggi", "yesterday", "today") unless they appear in the original.

5. Do NOT change the question or command format.
   - If the original starts with "Qual è…?", keep "Qual è…?".
   - If the original starts with "Inserisci…", keep "Inserisci…".

6. Do NOT add verbs like "Chiedi", "Dimmi", "Per favore" unless they were in the original.

7. Do NOT add any words that were not in the original prompt.

EXAMPLES:
- Original: "Qual è la data?" + Context: "data di nascita del paziente" → "Qual è la data di nascita del paziente?"
- Original: "Che data?" + Context: "data di nascita del titolare della clinica" → "Qual è la data di nascita del titolare della clinica?"
- Original: "What is the date?" + Context: "date of birth of the clinic owner" → "What is the date of birth of the clinic owner?"
- Original: "Qual è la data?" + Context: "data di nascita del titolare della clinica" → "Qual è la data di nascita del titolare della clinica?" (NOT "Ieri la data di nascita del titolare della clinica?")
- Original: "Inserisci la data" + Context: "data di nascita del paziente" → "Inserisci la data di nascita del paziente"

IMPORTANT:
- Only adapt prompts whose purpose is to request the data, regardless of whether the original is a question, an imperative, or another form.
- Keep the same tone, style, and grammatical form.
- Return ONLY a JSON array of strings, one for each original prompt in the same order.
- No markdown, no explanations, just the JSON array.

JSON array:"""

    return prompt
