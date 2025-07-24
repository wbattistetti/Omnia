from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
import os
import requests

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
    meanings_str = ', '.join(MEANINGS)
    prompt = (
        f"Rispondi in {IDE_LANGUE}. Dato il testo: '{user_desc}', scegli il tipo di meaning più adatto tra questa lista: [{meanings_str}]. "
        "Rispondi solo con il nome del meaning e una breve descrizione."
    )
    ai = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt}
    ])
    return {"ai": ai}

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
    prompt = (
        f"Rispondi in {IDE_LANGUE}. Ecco le specifiche raccolte:\nTipo: {meaning}\nDescrizione: {desc}\nConstraint: {constraints}\n"
        "Genera la struttura completa del DDT, con tutti i prompt necessari per:\n- Acquisizione\n- Conferma\n- Errori di validazione (per ogni constraint)\n- Successo\n- Prompt noInput/noMatch con 3 escalation\nRestituisci i messaggi in modo strutturato e chiaro."
    )
    ai = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt}
    ])
    return {"ai": ai} 