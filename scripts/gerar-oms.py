# Gera src/lib/oms-dados.ts a partir das tabelas oficiais da OMS:
#   curl -LO https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards/{weianthro,lenanthro,hcanthro}.txt
#   python3 scripts/gerar-oms.py <pasta com os .txt>
import json, sys
D = sys.argv[1]

def ler(f):
    t = {1: [], 2: []}
    for i, l in enumerate(open(f'{D}/{f}.txt')):
        if i == 0:
            continue
        p = l.split()
        sexo, dia = int(p[0]), int(p[1])
        if dia > 1826:
            continue
        if dia % 7 == 0 or dia == 1826 or dia <= 14:
            t[sexo].append([dia, float(p[2]), float(p[3]), float(p[4])])
    return t

saida = {'peso': ler('weianthro'), 'comprimento': ler('lenanthro'), 'pc': ler('hcanthro')}
linhas = ['// Tabelas LMS da OMS (Padrões de Crescimento Infantil, 2006), do repositório oficial',
          '// github.com/WorldHealthOrganization/anthro (data-raw/growthstandards). Gerado por',
          '// scripts/gerar-oms.py: idade em dias (diário até 14 dias, depois semanal até 5 anos), L, M, S.',
          '// Peso em kg; comprimento/altura e perímetro cefálico em cm. Sexo: M = menino, F = menina.',
          'export type LinhaLMS = readonly [dia: number, l: number, m: number, s: number];',
          'export const OMS: Record<"peso" | "comprimento" | "pc", Record<"M" | "F", readonly LinhaLMS[]>> = {']
for k, v in saida.items():
    linhas.append(f'  {k}: {{')
    for sexo, nome in ((1, 'M'), (2, 'F')):
        linhas.append(f'    {nome}: ' + json.dumps(v[sexo], separators=(',', ':')) + ',')
    linhas.append('  },')
linhas.append('};')
open('src/lib/oms-dados.ts', 'w').write('\n'.join(linhas) + '\n')
