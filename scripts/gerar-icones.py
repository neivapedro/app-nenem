# Gera os ícones do app a partir de scripts/icone-foto.png (quadrada, sem bordas):
#   python3 scripts/gerar-icones.py
# O iPhone arredonda os cantos sozinho; o "maskable" (Android) encolhe a foto
# para a área segura, com a própria foto desfocada no fundo.
from pathlib import Path
from PIL import Image, ImageFilter

raiz = Path(__file__).resolve().parent.parent
foto = Image.open(raiz / 'scripts' / 'icone-foto.png').convert('RGB')
publico = raiz / 'public'

for nome, tam in [('icone-512.png', 512), ('icone-192.png', 192), ('apple-touch-icon.png', 180)]:
    foto.resize((tam, tam), Image.LANCZOS).save(publico / nome, optimize=True)

fundo = foto.resize((512, 512), Image.LANCZOS).filter(ImageFilter.GaussianBlur(24))
miolo = foto.resize((420, 420), Image.LANCZOS)
fundo.paste(miolo, (46, 46))
fundo.save(publico / 'icone-maskable-512.png', optimize=True)
print('ícones gerados')
