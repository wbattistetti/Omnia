def get_intent_messages_prompt(intent_label: str) -> str:
    """
    Generate prompt for intent classification messages.
    Returns conversational messages in Italian for voice-based customer care system.
    """
    return f"""
You are an expert in designing conversational flows for customer care call centers.

CONTEXT:
You need to generate natural, spoken messages in Italian for an intent classification system. The system asks customers about the reason for their call (their intent/problem category) and handles cases where the customer doesn't respond or the system doesn't understand the response.

TASK:
Generate conversational messages in Italian for a voice-based customer care system that classifies customer intents.

INPUT INFORMATION:
- Intent label: "{intent_label}"
  This describes what the system is asking (e.g., "chiedi il problema", "chiedi il motivo della chiamata", "chiedi la tipologia di richiesta")

STYLE REQUIREMENTS:
- Natural Italian spoken language (not written/formal)
- Short sentences (6-15 words maximum)
- Professional but warm and human tone
- Phone conversation style: direct, clear, conversational
- Use light contractions when natural (può, devo, voglio)
- Polite and respectful
- No emojis, no exclamation marks except when necessary for clarification
- Do NOT use UI terms like "clicca", "digita", "inserisci"
- Use "dica", "dimmi", "può dire" for spoken interaction
- Do NOT include example values or placeholders in the main messages (except confirmation)
- Each message should feel like a real agent speaking

MESSAGE TYPES TO GENERATE:

1. START (1 message):
   - Initial question to ask the customer about their reason for calling
   - Must end with a question mark
   - Example style: "Mi può dire il motivo della chiamata?" or "Qual è il motivo della sua richiesta?"
   - Use the intent label to craft a natural question

2. NOINPUT (3 variations):
   - Used when the customer doesn't respond or remains silent
   - Each variation should be slightly different but equally polite
   - Progressive but not urgent/pushy
   - Examples:
     * "Scusi, non ho capito. Può ripetere il motivo?"
     * "Mi scusi, può dirmi qual è il problema?"
     * "Può ripetere, per favore?"

3. NOMATCH (3 variations):
   - Used when the system doesn't understand what the customer said
   - Should encourage the customer to rephrase or be more specific
   - Polite clarification requests
   - Examples:
     * "Non ho capito bene. Può spiegarmi meglio il motivo?"
     * "Scusi, può essere più specifico sul problema?"
     * "Non sono sicuro di aver capito. Può ripetere il motivo in altro modo?"

4. CONFIRMATION (1 message):
   - Used to confirm the identified intent before proceeding
   - Should include a placeholder for the detected intent
   - Format: "Il motivo è {{ '{{intent}}' }}. È corretto?"
   - Example: "Il motivo della chiamata è: cancellazione. È corretto?"

OUTPUT FORMAT (strict JSON, no markdown, no comments):
{{
  "start": [
    "Messaggio iniziale per chiedere l'intento"
  ],
  "noInput": [
    "Prima variazione quando il cliente non risponde",
    "Seconda variazione quando il cliente non risponde",
    "Terza variazione quando il cliente non risponde"
  ],
  "noMatch": [
    "Prima variazione quando il sistema non capisce",
    "Seconda variazione quando il sistema non capisce",
    "Terza variazione quando il sistema non capisce"
  ],
  "confirmation": [
    "Il motivo è {{ '{{intent}}' }}. È corretto?"
  ]
}}

IMPORTANT RULES:
- All messages must be in Italian
- Start messages must end with "?"
- Confirmation must include {{ '{{intent}}' }} placeholder
- NoInput and noMatch should have 3 different variations each
- Messages should feel natural and conversational, not robotic
- Avoid redundancy across variations
- Each variation should be slightly different in wording but similar in meaning

EXAMPLES OF GOOD MESSAGES:
- Start: "Mi può dire il motivo della chiamata?"
- NoInput: "Scusi, non ho sentito. Può ripetere il motivo?"
- NoMatch: "Non ho capito bene. Può spiegarmi meglio qual è il problema?"
- Confirmation: "Il motivo è: {{ '{{intent}}' }}. Ho capito bene?"

EXAMPLES TO AVOID:
- Too formal: "Potrebbe gentilmente fornirmi informazioni riguardo al motivo della sua telefonata?"
- Too long: "Mi scusi molto ma vorrei che lei mi dicesse quale sia il motivo per cui sta chiamando oggi"
- Robotic: "Inserire motivo chiamata"
- With examples: "Il motivo può essere: cancellazione o proroga"

Now generate the messages based on the intent label: "{intent_label}"
"""

