#!/usr/bin/env python3
"""
Test singola richiesta per debug
"""

import requests
import json

def test_single_request():
    test_case = "data di nascita"
    
    print(f"Testando: '{test_case}'")
    
    try:
        response = requests.post(
            "http://localhost:8000/step2",
            json=test_case,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
    except Exception as e:
        print(f"Errore: {e}")

if __name__ == "__main__":
    test_single_request()
