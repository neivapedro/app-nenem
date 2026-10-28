import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgora, useDados } from '../dados/contexto';
import { agoraIso, haQuanto, horaCurta, relogio, textoDuracao } from '../lib/datas';
import { FolhaQueHorasTerminou } from '../componentes/registrar';
import { useUmToque } from '../componentes/ui';
import { aplicarTemaAgora } from '../lib/tema';
import {
  duracaoPorLado,
  emAndamento,
  cronometroEsquecido,
  finalizarMamada,
  finalizarMamadaNaHora,
  finalizarSono,
  iniciarMamada,
  iniciarSono,
  ladoAtivo,
  ladoFinal,
  outroLado,
  pausarMamada,
  textoFralda,
  trocarLado,
  ultimaAlimentacao,
  ultimoDoTipo,
  ultimoLado,
} from '../lib/registros';
import type { Lado, Registro, RegistroDe } from '../lib/tipos';

/**
 * Modo noite: tela preta, letras em tom âmbar (pouca luz azul), botões
 * enormes. Um toque registra; o aviso de "desfazer" aparece embaixo.
 */
export function Noite() {
  const { registros, baseRegistro, gravar } = useDados();
  const agora = useAgora(1000);
  const navegar = useNavigate();
  const [aviso, setAviso] = useState<{ texto: string; desfazer: () => void } | null>(null);
  const andamento = emAndamento(registros);
  const m = andamento.mamada;
  const sono = andamento.sono;
  const alimentacao = ultimaAlimentacao(registros);
  const fralda = ultimoDoTipo(registros, 'fralda');
  // Um toque por vez: a grade muda depois do toque e o 2º cairia em outro botão
  const toque = useUmToque();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Tela acesa enquanto o modo noite está aberto (o iPhone não apaga no meio da mamada)
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return;
    let trava: { release: () => Promise<void> } | null = null;
    let vivo = true;
    const pedir = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen').then((t) => {
          if (vivo) trava = t;
          else void t.release();
        }).catch(() => undefined);
    };
    pedir();
    // O iPhone solta a trava quando o app vai para o fundo: pede de novo ao voltar
    document.addEventListener('visibilitychange', pedir);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', pedir);
      trava?.release().catch(() => undefined);
    };
  }, []);

  // Cronômetro esquecido: pergunta a hora antes de salvar
  const [perguntar, setPerguntar] = useState<'mamada' | 'sono' | null>(null);
  function finalizarMamadaAgora(quando?: Date) {
    if (!m) return;
    if (!quando && cronometroEsquecido(m, new Date())) return setPerguntar('mamada');
    setPerguntar(null);
    const fim = quando ? finalizarMamadaNaHora(m, quando) : finalizarMamada(m, new Date());
    salvar(fim, `Mamada salva (${textoDuracao(duracaoPorLado(fim, new Date()).total, true)})`, m);
  }
  function acordouAgora(quando?: Date) {
    if (!sono) return;
    if (!quando && cronometroEsquecido(sono, new Date())) return setPerguntar('sono');
    setPerguntar(null);
    salvar(finalizarSono(sono, quando ?? new Date()), 'Acordou: sono salvo', sono);
  }

  // Deixa a barra do sistema escura enquanto estiver aqui
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    const antes = meta.getAttribute('content');
    meta.setAttribute('content', '#000000');
    return () => {
      if (antes) meta.setAttribute('content', antes);
      else meta.remove();
      // O tema pode ter virado enquanto a tela estava aberta (ex.: 22h): reaplica já, depois que esta tela sai
      setTimeout(aplicarTemaAgora, 0);
    };
  }, []);

  const salvar = (r: Registro, texto: string, anterior: Registro | null) => {
    gravar({ tipo: 'registro', dado: r });
    setAviso({ texto, desfazer: () => gravar(anterior ? { tipo: 'registro', dado: anterior } : { tipo: 'excluir', dado: { alvo: 'registro', id: r.id } }) });
  };

  function fraldaAgora(xixi: boolean, coco: boolean) {
    const ini = agoraIso();
    const r: RegistroDe<'fralda'> = { ...baseRegistro(), tipo: 'fralda', inicio: ini, fim: ini, observacao: null, dados: { xixi, coco, cor: null } };
    salvar(r, `Fralda: ${textoFralda(r.dados)}`, null);
  }

  function comecar(lado: Lado) {
    const r = iniciarMamada(baseRegistro(), lado, new Date());
    salvar(r, `Mamada no peito ${lado}`, null);
  }

  const d = m ? duracaoPorLado(m, agora) : null;
  const ativo = m ? ladoAtivo(m) : null;
  // Lado em que terminou a última mamada no peito (mesmo que depois tenha vindo uma mamadeira)
  const ultimo = ultimoLado(registros);

  return (
    <div className="noite" role="main" aria-label="Modo noite">
      <div className="noite-topo">
        <span className="noite-relogio">{horaCurta(agora.toISOString())}</span>
        <button onClick={() => navegar('/')}>Sair</button>
      </div>
      <div className="noite-info" role="status">
        {aviso ? (
          <span className="noite-feito">
            {aviso.texto} ·{' '}
            <button
              className="noite-desfazer"
              onClick={() => {
                aviso.desfazer();
                setAviso(null);
              }}
            >
              desfazer
            </button>
          </span>
        ) : m && d ? (
          <>
            Mamando {ativo ? `no peito ${ativo}` : '(pausado)'} · <strong>{relogio(d.total)}</strong>
          </>
        ) : sono ? (
          <>Dormindo há {textoDuracao(agora.getTime() - new Date(sono.inicio).getTime())}</>
        ) : (
          <>
            Última alimentação: {alimentacao ? `${haQuanto(alimentacao.inicio, agora)}${ultimo ? ` · terminou no ${ultimo}` : ''}` : '—'}
            <br />
            Última fralda: {fralda ? haQuanto(fralda.inicio, agora) : '—'}
          </>
        )}
      </div>
      <div className="noite-grade">
        {m ? (
          <>
            <button className="ativo" onClick={toque(() => salvar(trocarLado(m, new Date(), ativo ? outroLado(ativo) : outroLado(ladoFinal(m) ?? 'D')), 'Trocou de peito', m))}>
              Trocar para o {ativo ? outroLado(ativo) : outroLado(ladoFinal(m) ?? 'D')}
              <small>
                E {relogio(d!.E)} · D {relogio(d!.D)}
              </small>
            </button>
            <button onClick={toque(() => salvar(ativo ? pausarMamada(m, new Date()) : trocarLado(m, new Date(), ladoFinal(m) ?? 'E'), ativo ? 'Pausado' : 'Continuando', m))}>
              {ativo ? 'Pausar' : 'Continuar'}
            </button>
            <button style={{ gridColumn: '1 / -1' }} onClick={toque(() => finalizarMamadaAgora())}>
              Finalizar mamada
            </button>
          </>
        ) : (
          <>
            <button onClick={toque(() => comecar('E'))}>
              Peito E{ultimo === 'E' && <small>terminou aqui</small>}
            </button>
            <button onClick={toque(() => comecar('D'))}>
              Peito D{ultimo === 'D' && <small>terminou aqui</small>}
            </button>
          </>
        )}
        <button onClick={toque(() => fraldaAgora(true, false))}>💧 Xixi</button>
        <button onClick={toque(() => fraldaAgora(false, true))}>💩 Cocô</button>
        <button onClick={toque(() => fraldaAgora(true, true))}>Xixi e cocô</button>
        {sono ? (
          <button className="ativo" onClick={toque(() => acordouAgora())}>
            Acordou
          </button>
        ) : (
          <button onClick={toque(() => salvar(iniciarSono(baseRegistro(), new Date()), 'Dormiu', null))}>Dormiu</button>
        )}
      </div>
      {perguntar === 'mamada' && m && <FolhaQueHorasTerminou r={m} aoFechar={() => setPerguntar(null)} aoSalvar={(q) => finalizarMamadaAgora(q)} />}
      {perguntar === 'sono' && sono && <FolhaQueHorasTerminou r={sono} aoFechar={() => setPerguntar(null)} aoSalvar={(q) => acordouAgora(q)} />}
    </div>
  );
}
