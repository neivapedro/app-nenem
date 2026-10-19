import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgora, useDados } from '../dados/contexto';
import { agoraIso, haQuanto, horaCurta, relogio, textoDuracao } from '../lib/datas';
import {
  duracaoPorLado,
  emAndamento,
  finalizarMamada,
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

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Deixa a barra do sistema escura enquanto estiver aqui
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    const antes = meta.getAttribute('content');
    meta.setAttribute('content', '#000000');
    return () => {
      if (antes) meta.setAttribute('content', antes);
      else meta.remove();
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
  const ultimo = alimentacao?.tipo === 'mamada' ? ladoFinal(alimentacao) : null;

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
            <button className="ativo" onClick={() => salvar(trocarLado(m, new Date(), ativo ? outroLado(ativo) : outroLado(ladoFinal(m) ?? 'D')), 'Trocou de peito', m)}>
              Trocar para o {ativo ? outroLado(ativo) : outroLado(ladoFinal(m) ?? 'D')}
              <small>
                E {relogio(d!.E)} · D {relogio(d!.D)}
              </small>
            </button>
            <button onClick={() => salvar(ativo ? pausarMamada(m, new Date()) : trocarLado(m, new Date(), ladoFinal(m) ?? 'E'), ativo ? 'Pausado' : 'Continuando', m)}>
              {ativo ? 'Pausar' : 'Continuar'}
            </button>
            <button style={{ gridColumn: '1 / -1' }} onClick={() => salvar(finalizarMamada(m, new Date()), `Mamada salva (${textoDuracao(duracaoPorLado(finalizarMamada(m, new Date()), new Date()).total)})`, m)}>
              Finalizar mamada
            </button>
          </>
        ) : (
          <>
            <button onClick={() => comecar('E')}>
              Peito E{ultimo === 'E' && <small>terminou aqui</small>}
            </button>
            <button onClick={() => comecar('D')}>
              Peito D{ultimo === 'D' && <small>terminou aqui</small>}
            </button>
          </>
        )}
        <button onClick={() => fraldaAgora(true, false)}>💧 Xixi</button>
        <button onClick={() => fraldaAgora(false, true)}>💩 Cocô</button>
        <button onClick={() => fraldaAgora(true, true)}>Xixi e cocô</button>
        {sono ? (
          <button className="ativo" onClick={() => salvar(finalizarSono(sono, new Date()), 'Acordou: sono salvo', sono)}>
            Acordou
          </button>
        ) : (
          <button onClick={() => salvar(iniciarSono(baseRegistro(), new Date()), 'Dormiu', null)}>Dormiu</button>
        )}
      </div>
    </div>
  );
}
