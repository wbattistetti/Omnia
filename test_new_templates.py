import requests
import json

# Test dei nuovi template
print('Testing new templates...')

# Test endpoint /api/factory/type-templates
try:
    r = requests.get('http://localhost:3100/api/factory/type-templates')
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        templates = r.json()
        print(f'Retrieved {len(templates)} templates')
        
        # Mostra i primi 3 template
        for i, (name, template) in enumerate(templates.items()):
            if i < 3:
                print(f'  - {name}: {template.get("type", "unknown")} - {template.get("label", "no label")}')
    else:
        print(f'Error: {r.text}')
except Exception as e:
    print(f'Error: {e}')

print()

# Test endpoint /step2 con nuovo template
try:
    r = requests.post('http://localhost:3100/step2', 
                     data='data di nascita',
                     headers={'Content-Type': 'text/plain'})
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        result = r.json()
        print('Step2 response:')
        print(json.dumps(result, indent=2))
    else:
        print(f'Error: {r.text}')
except Exception as e:
    print(f'Error: {e}')
