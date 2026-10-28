// Selo de quem registrou: bolinha com a inicial na cor própria de cada responsável.
// Só aparece quando a família tem 2 ou mais pessoas (com uma só, não diz nada).
import { useMemo } from 'react';
import { useDados } from '../dados/contexto';
import { coresDaFamilia, iniciaisDaFamilia, ordenarMembros } from '../lib/divisao';
import '../estilos/quem.css';

export interface Pessoa {
  id: string;
  /** Primeiro nome */
  nome: string;
  inicial: string;
  /** Índice da cor (quem.css: .quem-c0 … .quem-c3); -1 = neutra */
  cor: number;
  /** É quem está usando o aparelho */
  voce: boolean;
}

/** As pessoas da família na ordem estável (quem entrou antes primeiro) */
export function usePessoas(): Pessoa[] {
  const { membros, usuario } = useDados();
  return useMemo(() => {
    const cores = coresDaFamilia(membros);
    const iniciais = iniciaisDaFamilia(membros);
    return ordenarMembros(membros).map((m) => ({
      id: m.user_id,
      nome: m.nome.trim().split(/\s+/)[0] || 'Responsável',
      inicial: iniciais.get(m.user_id) ?? '?',
      cor: cores.get(m.user_id) ?? -1,
      voce: m.user_id === usuario?.id,
    }));
  }, [membros, usuario?.id]);
}

export const classeCor = (cor: number) => (cor >= 0 ? `quem-c${cor}` : 'quem-neutra');

/** Texto para leitores de tela e para o title */
export const rotuloQuem = (p: Pessoa) => `Registrado por ${p.nome}${p.voce ? ' (você)' : ''}`;

/**
 * Bolinha com a inicial de quem registrou. Nada quando a família tem uma pessoa só,
 * quando o registro é antigo (sem autor) ou de alguém que já saiu da família.
 */
export function SeloQuem({ id, className, decorativo }: { id: string | null | undefined; className?: string; decorativo?: boolean }) {
  const pessoas = usePessoas();
  if (!id || pessoas.length < 2) return null;
  const p = pessoas.find((x) => x.id === id);
  if (!p) return null;
  const rotulo = rotuloQuem(p);
  return (
    <span
      className={`quem-selo ${classeCor(p.cor)} ${p.inicial.length > 1 ? 'duas' : ''} ${className ?? ''}`}
      title={rotulo}
      {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': rotulo })}
    >
      {p.inicial}
    </span>
  );
}

/** Quem registrou, como texto (para pôr junto do selo decorativo); vazio nos mesmos casos do selo */
export function useQuemRegistrou(id: string | null | undefined): string {
  const pessoas = usePessoas();
  if (!id || pessoas.length < 2) return '';
  const p = pessoas.find((x) => x.id === id);
  return p ? rotuloQuem(p) : '';
}
