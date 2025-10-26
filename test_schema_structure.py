import requests
import json

# Test della risposta /step2
try:
    r = requests.post('http://localhost:3100/step2',
                     data='dati personali',
                     headers={'Content-Type': 'text/plain'})
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        result = r.json()
        print('Response structure:')
        print(json.dumps(result, indent=2))

        # Controlla la struttura schema
        if 'ai' in result and 'schema' in result['ai']:
            schema = result['ai']['schema']
            print(f'Schema keys: {list(schema.keys())}')
            if 'mainData' in schema:
                print(f'mainData type: {type(schema["mainData"])}')
                print(f'mainData length: {len(schema["mainData"])}')
                if len(schema['mainData']) > 0:
                    print(f'First mainData item: {schema["mainData"][0]}')
    else:
        print(f'Error: {r.text}')
except Exception as e:
    print(f'Error: {e}')
