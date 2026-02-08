#!/usr/bin/env python3
"""
Test manuale per verificare che i prompt per i subData vengano generati correttamente
"""

import requests
import json

def test_subdata_messages():
    """Test per verificare la generazione di messaggi specifici per subData"""
    
    # Test data per una data di nascita con subData
    test_data = {
        "name": "day",
        "label": "Day",
        "type": "number",
        "parentField": "birthDate",
        "constraints": [
            {"type": "range", "min": 1, "max": 31}
        ]
    }
    
    print("🧪 Testando generazione messaggi per subData 'day'...")
    print(f"📤 Dati inviati: {json.dumps(test_data, indent=2)}")
    
    try:
        response = requests.post(
            "http://localhost:8000/api/generateSubDataMessages",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📥 Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Risposta ricevuta:")
            print(json.dumps(result, indent=2))
            
            # Verifica che la risposta contenga i messaggi attesi
            if "ai" in result and isinstance(result["ai"], dict):
                messages = result["ai"]
                print(f"\n📋 Messaggi generati:")
                for step_type, step_messages in messages.items():
                    print(f"  {step_type}: {step_messages}")
                
                # Verifica che ci siano messaggi per i step principali
                expected_steps = ["start", "noMatch", "noInput", "confirmation", "success"]
                for step in expected_steps:
                    if step in messages:
                        print(f"✅ {step}: OK")
                    else:
                        print(f"❌ {step}: Mancante")
            else:
                print("❌ Risposta non nel formato atteso")
        else:
            print(f"❌ Errore HTTP: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Impossibile connettersi al backend. Assicurati che sia in esecuzione su http://localhost:8000")
    except Exception as e:
        print(f"❌ Errore: {e}")

def test_subdata_scripts():
    """Test per verificare la generazione di script di validazione per subData"""
    
    test_data = {
        "name": "day",
        "constraints": [
            {"type": "range", "min": 1, "max": 31}
        ]
    }
    
    print("\n🧪 Testando generazione script per subData 'day'...")
    print(f"📤 Dati inviati: {json.dumps(test_data, indent=2)}")
    
    try:
        response = requests.post(
            "http://localhost:8000/api/generateSubDataScripts",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📥 Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Risposta ricevuta:")
            print(json.dumps(result, indent=2))
            
            # Verifica che la risposta contenga gli script attesi
            if "ai" in result and isinstance(result["ai"], dict):
                scripts = result["ai"]
                print(f"\n📋 Script generati:")
                for lang, script in scripts.items():
                    print(f"  {lang}: {script[:100]}...")
            else:
                print("❌ Risposta non nel formato atteso")
        else:
            print(f"❌ Errore HTTP: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Impossibile connettersi al backend. Assicurati che sia in esecuzione su http://localhost:8000")
    except Exception as e:
        print(f"❌ Errore: {e}")

if __name__ == "__main__":
    print("🚀 Test manuale per la generazione di prompt subData")
    print("=" * 50)
    
    test_subdata_messages()
    test_subdata_scripts()
    
    print("\n" + "=" * 50)
    print("✅ Test completato!") 