// Registros desde uma data: o app abre só com os últimos dias; quando uma tela
// precisa de mais (meses, relatório de todo o período), busca o resto no banco.
import { useEffect, useMemo, useState } from 'react';
import { chaveDia, inicioDoDia } from '../lib/datas';
import type { Registro } from '../lib/tipos';
import { useDados } from './contexto';

/** null = ainda carregando; `erro` quando a busca falhou (ex.: sem internet) */
export function useRegistrosDesde(desde: string | null): { registros: Registro[] | null; erro: string | null } {
  const { registros, carregadoDesde, repo } = useDados();
  const precisa = !!desde && desde < carregadoDesde;
  const [antigos, setAntigos] = useState<{ desde: string; lista: Registro[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!precisa || !desde || (antigos && antigos.desde <= desde)) return;
    let vivo = true;
    setErro(null);
    repo
      .listarRegistros(inicioDoDia(desde).toISOString())
      .then((lista) => vivo && setAntigos({ desde, lista }))
      .catch((e) => vivo && setErro((e as Error).message || 'Não foi possível buscar os registros antigos.'));
    return () => {
      vivo = false;
    };
  }, [precisa, desde, repo, antigos]);

  const todos = useMemo(() => {
    if (!precisa) return registros;
    if (!antigos) return null;
    // Dias já carregados vêm do app (com as mudanças ao vivo); os anteriores, da busca
    return [...antigos.lista.filter((r) => chaveDia(r.inicio) < carregadoDesde), ...registros];
  }, [precisa, antigos, registros, carregadoDesde]);
  return { registros: todos, erro };
}
