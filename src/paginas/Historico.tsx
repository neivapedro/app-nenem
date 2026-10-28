import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DiaHistorico } from '../componentes/historico-linha';
import { EstadoVazio } from '../componentes/ilustracoes';
import { FolhaEditar } from '../componentes/registrar';
import { Icone } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { useRegistrosDesde } from '../dados/historico';
import { chaveDia, dataBr, somarDiasLocal } from '../lib/datas';
import { diasDaJanela, itensDoDia, janelaDaData, janelaInicial, semanaAnterior, textoSemana, DIAS_SEMANA, type Janela } from '../lib/historico-dias';
import { registrosPorDia } from '../lib/registros';
import type { Registro, TipoRegistro } from '../lib/tipos';

type Filtro = 'todos' | 'alimentacao' | 'fralda' | 'sono' | 'saude';

const FILTROS: { valor: Filtro; rotulo: string; tipos: TipoRegistro[]; nenhum: string }[] = [
  { valor: 'todos', rotulo: 'Tudo', tipos: ['mamada', 'mamadeira', 'fralda', 'sono', 'remedio', 'temperatura', 'extracao', 'refeicao'], nenhum: 'Nenhum registro' },
  { valor: 'alimentacao', rotulo: 'Mamadas', tipos: ['mamada', 'mamadeira'], nenhum: 'Nenhuma mamada' },
  { valor: 'fralda', rotulo: 'Fraldas', tipos: ['fralda'], nenhum: 'Nenhuma fralda' },
  { valor: 'sono', rotulo: 'Sono', tipos: ['sono'], nenhum: 'Nenhum sono' },
  { valor: 'saude', rotulo: 'Saúde', tipos: ['remedio', 'temperatura'], nenhum: 'Nada de saúde' },
];

/** Últimos registros mostrados: a tela não some enquanto busca dias mais antigos */
type Cache = MutableRefObject<{ registros: Registro[]; desde: string } | null>;

const maior = (a: string, b: string) => (a > b ? a : b);

const menosMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Historico() {
  const { hoje, bebe, carregadoDesde, pendentes, gravar, mostrarAviso, leite } = useDados();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [editando, setEditando] = useState<Registro | null>(null);
  // null = a semana mais recente (acompanha a virada do dia)
  const [janelaEscolhida, setJanela] = useState<Janela | null>(null);
  // Dia escolhido em "Ir para a data" (n muda a cada escolha: rola de novo mesmo no mesmo dia)
  const [alvo, setAlvo] = useState<{ dia: string; n: number } | null>(null);
  // Exclusão de um registro antigo (fora dos dias que o app carrega): busca de novo quando a fila esvaziar
  const [recarga, setRecarga] = useState(0);
  const [aguardaFila, setAguardaFila] = useState(false);
  const cache: Cache = useRef(null);

  const inicio = bebe?.nascimento ? chaveDia(bebe.nascimento) : null;
  const janela = janelaEscolhida ?? janelaInicial(hoje);
  const foraDeHoje = janela.ate < hoje;

  useEffect(() => {
    if (aguardaFila && pendentes === 0) {
      setAguardaFila(false);
      setRecarga((n) => n + 1);
    }
  }, [aguardaFila, pendentes]);

  const irPara = (dia: string) => {
    if (!/^\d{4}-\d\d-\d\d$/.test(dia)) return;
    setJanela(janelaDaData(dia, hoje, inicio));
    setAlvo((a) => ({ dia: dia > hoje ? hoje : inicio && dia < inicio ? inicio : dia, n: (a?.n ?? 0) + 1 }));
  };

  // "/historico?dia=AAAA-MM-DD" (ex.: lembrança "Há 1 mês…"): abre já naquele dia, uma vez
  const [parametros, setParametros] = useSearchParams();
  const diaPedido = parametros.get('dia');
  useEffect(() => {
    if (!diaPedido) return;
    irPara(diaPedido);
    setParametros((p) => {
      p.delete('dia');
      return p;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaPedido]);

  const voltarParaHoje = () => {
    setJanela(null);
    setAlvo(null);
    window.scrollTo({ top: 0, behavior: menosMovimento() ? 'auto' : 'smooth' });
  };

  const fecharEdicao = useCallback(() => {
    setEditando((r) => {
      if (r && chaveDia(r.inicio) < carregadoDesde) setAguardaFila(true);
      return null;
    });
  }, [carregadoDesde]);

  // Apagar pelo deslize: sem perguntar, com "Desfazer" no aviso (como as outras exclusões do app)
  const apagar = useCallback(
    (r: Registro) => {
      // Extração guardada no estoque: o pote tem o mesmo id do registro e sai junto
      const pote = r.tipo === 'extracao' ? leite.find((p) => p.id === r.id) : undefined;
      const antigo = chaveDia(r.inicio) < carregadoDesde;
      gravar({ tipo: 'excluir', dado: { alvo: 'registro', id: r.id } }, ...(pote ? [{ tipo: 'excluir' as const, dado: { alvo: 'leite' as const, id: pote.id } }] : []));
      if (antigo) setAguardaFila(true);
      mostrarAviso({
        texto: pote ? 'Registro apagado (e o pote do estoque)' : 'Registro apagado',
        desfazer: () => {
          gravar({ tipo: 'registro', dado: r }, ...(pote ? [{ tipo: 'colecao' as const, colecao: 'leite' as const, dado: pote }] : []));
          if (antigo) setAguardaFila(true);
        },
      });
    },
    [leite, carregadoDesde, gravar, mostrarAviso],
  );

  return (
    <div className="pilha historico">
      <div className="abas" role="tablist" aria-label="Filtrar">
        {FILTROS.map((f) => (
          <button key={f.valor} role="tab" aria-selected={filtro === f.valor} className={filtro === f.valor ? 'ativo' : ''} onClick={() => setFiltro(f.valor)}>
            {f.rotulo}
          </button>
        ))}
      </div>

      <div className="hist-ferramentas">
        <label className="hist-ir">
          <Icone nome="agenda" />
          <span>Ir para a data</span>
          <input
            type="date"
            value={alvo?.dia ?? janela.ate}
            min={inicio ?? undefined}
            max={hoje}
            onChange={(e) => irPara(e.target.value)}
            aria-label="Ir para a data"
          />
        </label>
        {foraDeHoje && (
          <button type="button" className="botao pequeno hist-hoje" onClick={voltarParaHoje}>
            Voltar para hoje
          </button>
        )}
      </div>

      <ListaDias
        key={recarga}
        janela={janela}
        filtro={filtro}
        alvo={alvo}
        inicio={inicio}
        cache={cache}
        aoEditar={setEditando}
        aoApagar={apagar}
        aoVerAnterior={() => setJanela(semanaAnterior(janela, inicio))}
      />

      {editando && <FolhaEditar r={editando} aoFechar={fecharEdicao} />}
    </div>
  );
}

function ListaDias({
  janela,
  filtro,
  alvo,
  inicio,
  cache,
  aoEditar,
  aoApagar,
  aoVerAnterior,
}: {
  janela: Janela;
  filtro: Filtro;
  alvo: { dia: string; n: number } | null;
  inicio: string | null;
  cache: Cache;
  aoEditar: (r: Registro) => void;
  aoApagar: (r: Registro) => void;
  aoVerAnterior: () => void;
}) {
  const { hoje, nomeDe } = useDados();
  const agora = useAgora(60_000);
  // Um dia antes: o sono que começou na véspera e entrou no primeiro dia
  const desde = somarDiasLocal(janela.de, -1);
  const { registros, erro } = useRegistrosDesde(desde);

  useEffect(() => {
    if (registros) cache.current = { registros, desde };
  }, [registros, desde, cache]);

  // Enquanto busca, mostra o que já tinha (só os dias que ele cobre)
  const anterior = cache.current;
  const regs = registros ?? anterior?.registros ?? null;
  const cobertoDesde = registros ? desde : (anterior?.desde ?? null);
  const carregando = !registros;

  const f = FILTROS.find((x) => x.valor === filtro)!;
  const dias = useMemo(() => diasDaJanela(janela), [janela]);
  const doDia = useMemo(() => registrosPorDia(regs ?? []), [regs]);

  const linhas = useMemo(
    () =>
      dias
        .filter((d) => cobertoDesde !== null && d > cobertoDesde)
        .map((dia, i) => {
          const lista = doDia(dia);
          return { dia, i, lista, itens: itensDoDia(lista, dia, f.tipos, agora) };
        })
        // Dia antes do nascimento sem nada: não aparece
        .filter((l) => !inicio || l.dia >= inicio || l.lista.some((r) => chaveDia(r.inicio) === l.dia))
        // Com filtro, os dias sem nada daquele tipo saem (no "Tudo", o dia vazio aparece como vazio)
        .filter((l) => filtro === 'todos' || l.itens.length > 0),
    [dias, cobertoDesde, doDia, f.tipos, agora, inicio, filtro],
  );

  // "Ir para a data": rola até o dia escolhido quando ele aparece
  const rolado = useRef(0);
  useEffect(() => {
    if (!alvo || rolado.current === alvo.n || carregando) return;
    const el = document.getElementById(`hist-dia-${alvo.dia}`) ?? document.querySelector('.hist-dia');
    if (!el) return;
    rolado.current = alvo.n;
    el.scrollIntoView({ behavior: menosMovimento() ? 'auto' : 'smooth', block: 'start' });
  }, [alvo, carregando, linhas]);

  // A legenda das cores aparece uma vez, na primeira fita da tela
  const comLegenda = linhas.findIndex((l) => l.lista.some((r) => r.tipo === 'mamada' || r.tipo === 'mamadeira' || r.tipo === 'fralda' || r.tipo === 'sono'));
  const noComeco = !!inicio && janela.de <= inicio;
  const vazio = `${f.nenhum} neste dia.`;
  // Nenhum registro em todos os dias carregados: um aviso só, no lugar de 7 cartões vazios
  const semNada = linhas.length === 0 || linhas.every((l) => l.lista.length === 0);
  // Sem nascimento e sem nada registrado: não há semana anterior para ver
  const semAnterior = noComeco || (!inicio && !carregando && (regs ?? []).length === 0);

  return (
    <>
      <p className="mudo hist-periodo" aria-live="polite">
        {textoSemana(janela.de, janela.ate)}
        {filtro !== 'todos' ? ` · só ${f.rotulo.toLowerCase()}` : ''}
      </p>

      {erro && <div className="alerta erro">Não deu para buscar os dias mais antigos: {erro}</div>}

      {!carregando && semNada && (
        <EstadoVazio
          ilustracao={filtro === 'alimentacao' ? 'mamadeira' : filtro === 'sono' ? 'sono' : filtro === 'saude' ? 'remedios' : 'historico'}
          titulo={filtro === 'todos' ? 'Nenhum registro nestes dias' : `${f.nenhum} nestes dias`}
          texto={filtro === 'todos' ? 'O que vocês registrarem na tela Hoje aparece aqui.' : 'Os outros registros continuam em “Tudo”.'}
        />
      )}

      {!semNada && linhas.map((l, k) => (
        <div key={l.dia === alvo?.dia ? `${l.dia}-${alvo.n}` : l.dia} className="hist-bloco">
          {l.i > 0 && l.i % DIAS_SEMANA === 0 && (
            <div className="hist-semana" role="separator">
              <span>{textoSemana(maior(janela.de, somarDiasLocal(l.dia, -(DIAS_SEMANA - 1))), l.dia)}</span>
            </div>
          )}
          <DiaHistorico
            dia={l.dia}
            hoje={hoje}
            agora={agora}
            registrosDoDia={l.lista}
            itens={l.itens}
            vazio={vazio}
            ordem={k}
            alvo={l.dia === alvo?.dia}
            legenda={k === comLegenda}
            nomeDe={nomeDe}
            aoEditar={aoEditar}
            aoApagar={aoApagar}
          />
        </div>
      ))}

      {carregando && !erro && <p className="mudo hist-carregando">Carregando os dias mais antigos…</p>}

      {semAnterior ? (
        noComeco && <p className="mudo hist-fim">Começo do histórico: nascimento em {dataBr(inicio!)}.</p>
      ) : (
        <button type="button" className="botao" disabled={carregando && !erro} onClick={aoVerAnterior}>
          {carregando && !erro ? 'Carregando…' : 'Ver semana anterior'}
        </button>
      )}
    </>
  );
}
