import os
import requests

GROQ_KEY = os.environ.get("Groq_key")
IDE_LANGUE = os.environ.get("IdeLangue", "it")  # Default italiano
GROQ_URL = "https://api.groq.com/v1/chat/completions"
MODEL = "llama3-70b-8192"

# Lista di meaning disponibili (esempio)
MEANINGS = [
    "date", "email", "phone", "address", "number", "text", "boolean"
]


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


def step_1_prompt():
    return f"Rispondi in {IDE_LANGUE}. Descrivi il tipo di informazione che vuoi acquisire (es: data di nascita, email, ecc)."

def step_2_prompt(user_desc):
    meanings_str = ', '.join(MEANINGS)
    return (
        f"Rispondi in {IDE_LANGUE}. Dato il testo: '{user_desc}', scegli il tipo di meaning più adatto tra questa lista: [{meanings_str}]. "
        "Rispondi solo con il nome del meaning e una breve descrizione."
    )

def step_3_prompt(meaning, desc):
    return (
        f"Rispondi in {IDE_LANGUE}. Per il dato '{meaning}' ({desc}), quali constraint/validazioni vuoi applicare? "
        "(es: obbligatorio, formato, range, ecc). Suggerisci i più adatti e chiedi se aggiungere altri constraint."
    )

def step_3b_formalize_constraints(user_constraints, meaning, desc):
    return (
        f"Rispondi in {IDE_LANGUE}. Interpreta e formalizza la risposta utente '{user_constraints}' in una lista di constraint chiari e strutturati per il dato '{meaning}' ({desc})."
    )

def step_4_prompt(meaning, desc, constraints):
    return (
        f"Rispondi in {IDE_LANGUE}. Ecco le specifiche raccolte:\nTipo: {meaning}\nDescrizione: {desc}\nConstraint: {constraints}\n"
        "Genera la struttura completa del DDT, con tutti i prompt necessari per:\n- Acquisizione\n- Conferma\n- Errori di validazione (per ogni constraint)\n- Successo\n- Prompt noInput/noMatch con 3 escalation\nRestituisci i messaggi in modo strutturato e chiaro."
    )


def main():
    print("--- Step 1: Prompt iniziale (statico, multilingua) ---")
    prompt1 = step_1_prompt()
    print(f"AI: {prompt1}")
    user_desc = input("Utente: ")

    print("\n--- Step 2: Associazione meaning ---")
    prompt2 = step_2_prompt(user_desc)
    meaning_resp = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt2}
    ])
    print(f"AI: {meaning_resp}")
    # Parsing semplice: estrai primo word come meaning, resto come descrizione
    meaning, *desc_parts = meaning_resp.split(" ", 1)
    desc = desc_parts[0] if desc_parts else meaning_resp

    print(f"\n[Label stabilizzata] Tipo: {meaning} – {desc}")

    print("\n--- Step 3: Richiesta constraint ---")
    prompt3 = step_3_prompt(meaning, desc)
    print(f"AI: {prompt3}")
    user_constraints = input("Utente: ")

    print("\n--- Step 3b: Formalizzazione constraint ---")
    prompt3b = step_3b_formalize_constraints(user_constraints, meaning, desc)
    constraints_resp = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt3b}
    ])
    print(f"AI: {constraints_resp}")
    constraints = constraints_resp.replace("\n", ", ")
    print(f"\n[Label stabilizzata] Constraint: {constraints}")

    print("\n--- Step 4: Generazione struttura DDT e messaggi ---")
    prompt4 = step_4_prompt(meaning, desc, constraints)
    ddt_resp = call_groq([
        {"role": "system", "content": f"Rispondi sempre in {IDE_LANGUE}."},
        {"role": "user", "content": prompt4}
    ])
    print(f"\n[DDT generato]\n{ddt_resp}")

if __name__ == "__main__":
    main() 