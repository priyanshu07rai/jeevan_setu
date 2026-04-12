import os

directory = 'frontend_web/src'

for root, _, files in os.walk(directory):
    for filename in files:
        if filename.endswith('.jsx'):
            file_path = os.path.join(root, filename)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if "fetch('/api/v2/" in content:
                print(f"Fixing {file_path}...")
                content = content.replace("fetch('/api/v2/", "fetch('https://jeevansetu-api.onrender.com/api/v2/")
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
