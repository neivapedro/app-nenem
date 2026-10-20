// Registros desde uma data: o app abre só com os últimos dias; quando uma tela
// precisa de mais (meses, relatório de todo o período), busca o resto no banco.
import { useEffect, useMemo, useState } from 'react';
import { chaveDia, inicioDoDia } from '../lib/datas';
import { traduzirErro } from '../lib/erros';
import type { Registro } from '../lib/tipos';
import { useDados } from './contexto';

/** null = ainda carregando; `erro` quando a busca falhou (ex.: sem internet) */
export function useRegistrosDesde(desde: string | null): { registros: Registro[] | null; erro: string | null } {
  const { registros, carregadoDesde, repo } = useDados();
  const precisa = !!desde && desde < carregadoDesde;
  const [antigos, setAntigos] = useState<{ desde: string; lista: Registro[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Voltou a internet depois de uma falha: tenta de novo sozinho
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!erro) return;
    const online = () => setTentativa((t) => t + 1);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [erro]);

  useEffect(() => {
    if (!precisa || !desde || (antigos && antigos.desde <= desde)) return;
    let vivo = true;
    setErro(null);
    repo
      .listarRegistros(inicioDoDia(desde).toISOString())
      .then((lista) => vivo && setAntigos({ desde, lista }))
      .catch((e) => vivo && setErro(traduzirErro(e) || 'Não foi possível buscar os registros antigos.'));
    return () => {
      vivo = false;
    };
  }, [precisa, desde, repo, antigos, tentativa]);

  const todos = useMemo(() => {
    if (!precisa) return registros;
    // Ainda não chegou a busca que cobre esta data: carregando (e não meio vazio)
    if (!antigos || antigos.desde > desde!) return null;
    // Dias já carregados vêm do app (com as mudanças ao vivo); os anteriores, da busca
    // (os em andamento antigos vêm nas duas listas: entram uma vez só)
    const noApp = new Set(registros.map((r) => r.id));
    return [...antigos.lista.filter((r) => chaveDia(r.inicio) < carregadoDesde && !noApp.has(r.id)), ...registros];
  }, [precisa, desde, antigos, registros, carregadoDesde]);
  return { registros: todos, erro };
}
