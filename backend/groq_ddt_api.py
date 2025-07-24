from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
import os
import requests
import json

GROQ_KEY = os.environ.get("Groq_key")
IDE_LANGUE = os.environ.get("IdeLangue", "it")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"  # PATCH: endpoint corretto
MODEL = "llama3-70b-8192"

MEANINGS = [
    "date", "email", "phone", "address", "number", "text", "boolean"
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def call_groq(messages):
    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MODEL,
        "messages": messages
    }
    response = requests.post(GROQ_URL, headers=headers, json=data)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]

@app.post("/step1")
def step1():
    prompt = f"Rispondi in {IDE_LANGUE}. Descrivi il tipo di informazione che vuoi acquisire (es: data di nascita, email, ecc)."
    return {"ai": prompt}

@app.post("/step2")
def step2(user_desc: str = Body(...)):
    IT_MEANINGS = [
        'data di nascita', 'email', 'numero di telefono', 'indirizzo', 'numero', 'testo', 'booleano'
    ]
    prompt = (
        f"You are a data type classifier. Given the user text: '{user_desc}', extract ONLY the most appropriate data type from this list (in Italian): [{', '.join(IT_MEANINGS)}].\n"
        "Reply ONLY with a valid JSON object: { \"type\": <type> } where <type> is the Italian name of the type (e.g., 'numero di telefono', 'email', 'data di nascita', etc.).\n"
        "If the text is ambiguous, nonsense, or does NOT clearly indicate one of these types, reply ONLY with: { \"type\": \"unrecognized_data_type\" }.\n"
        "Do NOT guess, do NOT reply 'text' if you are not sure. If in doubt, reply only with { \"type\": \"unrecognized_data_type\" }.\n"
        "Examples:\n"
        "- Input: 'Voglio una cosa che riconosca i numeri di telefono' → Output: { \"type\": \"numero di telefono\" }\n"
        "- Input: 'Serve la data di nascita' → Output: { \"type\": \"data di nascita\" }\n"
        "- Input: 'asdasd' → Output: { \"type\": \"unrecognized_data_type\" }\n"
    )
    ai = call_groq([
        {"role": "system", "content": "Reply always in Italian."},
        {"role": "user", "content": prompt}
    ])
    try:
        ai_obj = json.loads(ai)
        if not isinstance(ai_obj, dict) or 'type' not in ai_obj:
            return {"error": "unrecognized_data_type"}
        if ai_obj['type'] == 'unrecognized_data_type':
            return {"error": "unrecognized_data_type"}
        return {"ai": ai_obj['type']}
    except Exception:
        return {"error": "unrecognized_data_type"}

@app.post("/step3")
def step3(meaning: str = Body(...), desc: str = Body(...)):
    prompt = (
        f"Rispondi in {IDE_LANGUE}. Per il dato '{meaning}' ({desc}), quali constraint/validazioni vuoi applicare? "
        "(es: obbligatorio, formato, range, ecc). Suggerisci i più adatti e chiedi se aggiungere altri constraint."
    )
    ai = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt}
    ])
    return {"ai": ai}

@app.post("/step3b")
def step3b(user_constraints: str = Body(...), meaning: str = Body(...), desc: str = Body(...)):
    prompt = (
        f"Rispondi in {IDE_LANGUE}. Interpreta e formalizza la risposta utente '{user_constraints}' in una lista di constraint chiari e strutturati per il dato '{meaning}' ({desc})."
    )
    ai = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt}
    ])
    return {"ai": ai}

@app.post("/step4")
def step4(meaning: str = Body(...), desc: str = Body(...), constraints: str = Body(...)):
    DDT_EXAMPLE_JSON = """
    {
      "_id": "687dc1d84a68b869802aea16",
      "id": "DDT_BirthOfDate",
      "label": "Acquire date of birth",
      "description": "Flow to acquire the user's date of birth, handling partial input, validation, confirmation, and success.",
      "dataType": "Object",
      "variable": "dateOfBirth",
      "constraints": [],
      "steps": {
        "start": [
          { "actionInstanceId": "SayMessage_GUID1", "actionType": "askQuestion" }
        ],
        "noMatch": [
          { "actionInstanceId": "SayMessage_GUID2", "actionType": "escalation" },
          { "actionInstanceId": "SayMessage_GUID3", "actionType": "escalation" },
          { "actionInstanceId": "SayMessage_GUID4", "actionType": "escalation" }
        ],
        "noInput": [
          { "actionInstanceId": "SayMessage_GUID5", "actionType": "escalation" },
          { "actionInstanceId": "SayMessage_GUID6", "actionType": "escalation" },
          { "actionInstanceId": "SayMessage_GUID7", "actionType": "escalation" }
        ],
        "confirmation": [
          { "actionInstanceId": "SayMessage_GUID8", "actionType": "confirmation" },
          { "actionInstanceId": "SayMessage_GUID9", "actionType": "confirmation" }
        ],
        "success": [
          { "actionInstanceId": "SayMessage_GUID10", "actionType": "success" }
        ],
        "notAcquired": [
          { "actionInstanceId": "SayMessage_GUID11", "actionType": "notAcquired" }
        ]
      },
      "success": {}
    }
    """
    prompt = (
        f"""You are an expert dialogue template generator for conversational AI.
Given the following specifications:
- Data type: {meaning}
- Description: {desc}

Generate ONLY a JSON object with EXACTLY this structure:

{{
  "ddt": <COMPLETE_DDT_OBJECT>,
  "messages": <RUNTIME_MESSAGES_OBJECT>
}}

Where:
- "ddt" is a Data Dialogue Template object with the same ontological structure as this example: {DDT_EXAMPLE_JSON}
- Include the standard steps: start, noMatch (3 escalations), noInput (3 escalations), confirmation (2 escalations), success, notAcquired.
- Each actionInstanceId must be the action name plus a randomly generated GUID/UUID (e.g., SayMessage_3f2a1b4c-...).
- For each action, generate a runtime string key as: runtime.<DDT_ID>.<step>#<n>.<actionInstanceId>.text
  - <n> is the escalation number (starting from 1) for that step. ALWAYS include #<n> even if there is only one action for that step.
  - Example: runtime.DDT_Phone.noMatch#2.SayMessage_GUID.text
- "messages" is an object with all runtime string keys and their values (in Italian and English).
  - Each value in the "messages" object MUST be a multilingual object with language codes as keys (e.g., {{ "it": "...", "en": "..." }}). DO NOT use plain strings or arrays.
  - Example:
    "runtime.DDT_Phone.noMatch#1.SayMessage_GUID.text": {{ "it": "Testo in italiano", "en": "English text" }}
- The messages MUST be synthetic and highly conversational, as if for a fast-paced call center conversation (short, direct, natural, not formal).
- The messages object must contain ALL the new runtime string keys and their values, so they can be added to the existing translations structure in memory (do NOT overwrite existing keys, only add new ones).
- DO NOT include any explanation, markdown, or text outside the JSON object.
- The output MUST be valid JSON, parsable by Python.

Example output:
{{
  "ddt": {{ ... }},
  "messages": {{ ... }}
}}
"""
    )
    ai = call_groq([
        {"role": "system", "content": "Always reply in English."},
        {"role": "user", "content": prompt}
    ])
    try:
        ai_obj = json.loads(ai)
        return {"ai": ai_obj}
    except Exception as e:
        return {"ai": None, "error": f"Failed to parse AI JSON: {str(e)}"} 