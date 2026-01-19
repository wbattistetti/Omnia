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

    texts_list = "\n".join([f"- {text}" for text in original_texts])

    prompt = f"""You are a dialogue designer assistant. Your task is to adapt template prompts to a new specific context.

CONTEXT:
- Template label: "{template_label}"
- New context: "{context_label}"
- Language: {lang_name}

ORIGINAL TEMPLATE PROMPTS (to adapt):
{texts_list}

TASK:
Adapt each prompt to match the new context. The adapted prompts should:
1. Include the specific context from "{context_label}" (e.g., "data di nascita del paziente" instead of just "data")
2. Maintain the same tone and style as the original
3. Be natural and conversational in {lang_name}
4. Keep the same structure and length as much as possible

IMPORTANT:
- Only adapt prompts that ask for the data (start prompts)
- Do NOT change generic prompts like "Ripeti la data" or "Non ho capito" - these are context-independent
- If a prompt is already generic (doesn't mention the specific data type), keep it as is

Return ONLY a JSON array of strings, one for each original prompt in the same order.
Example format: ["Adapted prompt 1", "Adapted prompt 2", ...]

JSON array:"""

    return prompt
