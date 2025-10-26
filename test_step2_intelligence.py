#!/usr/bin/env python3
"""
Test script per verificare il nuovo Template Intelligence Service
"""

import requests
import json

def test_step2_intelligence():
    """Test dell'endpoint step2 con Template Intelligence"""
    
    # Test cases
    test_cases = [
        "data di nascita",
        "dati personali",
        "dati del veicolo",
        "informazioni di contatto"
    ]
    
    base_url = "http://localhost:8000"
    
    for test_case in test_cases:
        print(f"\n[TEST] Testando: '{test_case}'")
        print("=" * 50)
        
        try:
            response = requests.post(
                f"{base_url}/step2",
                json=test_case,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"[OK] Status: {response.status_code}")
                
                if 'ai' in data:
                    ai_data = data['ai']
                    print(f"[INFO] Label: {ai_data.get('type', 'N/A')}")
                    
                    if 'intelligence_analysis' in ai_data:
                        analysis = ai_data['intelligence_analysis']
                        print(f"[AI] Action: {analysis.get('action', 'N/A')}")
                        print(f"[AI] Intent: {analysis.get('intent', 'N/A')}")
                        print(f"[AI] Complexity: {analysis.get('complexity', 'N/A')}")
                        print(f"[AI] Category: {analysis.get('category', 'N/A')}")
                        print(f"[AI] Reasoning: {analysis.get('reasoning', 'N/A')}")
                        print(f"[AI] Requires Approval: {analysis.get('requires_approval', False)}")
                    
                    if 'schema' in ai_data and 'mainData' in ai_data['schema']:
                        main_data = ai_data['schema']['mainData']
                        print(f"[DATA] Main Data Fields: {len(main_data)}")
                        for field in main_data:
                            print(f"  - {field.get('label', 'N/A')} ({field.get('type', 'N/A')})")
                            if field.get('subData'):
                                print(f"    Sub-data: {len(field['subData'])} items")
                
                print(f"[RESPONSE] Full Response: {json.dumps(data, indent=2)}")
                
            else:
                print(f"[ERROR] Status: {response.status_code}")
                print(f"Response: {response.text}")
                
        except requests.exceptions.ConnectionError:
            print("[ERROR] Server non raggiungibile. Assicurati che il backend sia in esecuzione.")
        except Exception as e:
            print(f"[ERROR] {e}")
        
        print()

if __name__ == "__main__":
    test_step2_intelligence()
