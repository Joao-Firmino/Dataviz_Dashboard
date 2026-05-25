#!/usr/bin/env python3
"""
Script para atualizar o cache-bust version no index.html
Execute antes de fazer deploy ou quando fizer mudanças nos arquivos estáticos.
"""

from datetime import datetime
import re

# Gera um timestamp único
timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

# Lê o arquivo index.html
with open("index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Padrão para encontrar e substituir o ?v=XXXXXXXXXXXX
# Isso funciona para .css e .js com type=module
pattern = r'((?:main\.css|main\.js)[?]v=)\d+'
replacement = rf'\g<1>{timestamp}'

# Faz a substituição
new_content = re.sub(pattern, replacement, content)

# Escreve de volta
with open("index.html", "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"✅ Cache-bust atualizado para: {timestamp}")
print("Arquivos afetados:")
print(f"  • ./styles/main.css?v={timestamp}")
print(f"  • ./js/main.js?v={timestamp}")
