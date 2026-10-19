// Ações dos atalhos da Siri (registrar sem abrir o app). Sem dependências
// externas: a função nenem-atalho aplica a ação; o app mostra os endereços.

export interface AcaoAtalho {
  id: string;
  nome: string;
  frase: string;
}

export const ACOES_ATALHO: AcaoAtalho[] = [
  { id: 'fralda-xixi', nome: 'Fralda: xixi', frase: 'Fralda xixi' },
  { id: 'fralda-coco', nome: 'Fralda: cocô', frase: 'Fralda cocô' },
  { id: 'fralda-ambos', nome: 'Fralda: xixi e cocô', frase: 'Fralda completa' },
  { id: 'mamada-e', nome: 'Começar mamada no peito esquerdo', frase: 'Mamada esquerdo' },
  { id: 'mamada-d', nome: 'Começar mamada no peito direito', frase: 'Mamada direito' },
  { id: 'mamada-trocar', nome: 'Trocar de peito', frase: 'Trocar peito' },
  { id: 'mamada-fim', nome: 'Finalizar mamada', frase: 'Fim da mamada' },
  { id: 'sono-inicio', nome: 'Dormiu', frase: 'Bebê dormiu' },
  { id: 'sono-fim', nome: 'Acordou', frase: 'Bebê acordou' },
  { id: 'resumo', nome: 'Como está o dia (só consulta)', frase: 'Resumo do bebê' },
];

export interface Segmento {
  lado: 'E' | 'D';
  inicio: string;
  fim: string | null;
}

/** Fecha o trecho aberto e devolve os trechos (usado em trocar e finalizar) */
export function fecharTrecho(segs: Segmento[], agoraIso: string): Segmento[] {
  return segs.map((s) => (s.fim ? s : { ...s, fim: agoraIso < s.inicio ? s.inicio : agoraIso }));
}

export function ladoAberto(segs: Segmento[]): 'E' | 'D' | null {
  return segs.find((s) => !s.fim)?.lado ?? null;
}

export function minutos(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(m / 60);
  if (!h) return `${m} minutos`;
  return `${h} hora${h > 1 ? 's' : ''}${m % 60 ? ` e ${m % 60} minutos` : ''}`;
}
