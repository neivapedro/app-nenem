// Um dia do Histórico: cabeçalho com o resumo, mini-fita das 24 h e a linha do
// tempo vertical (ícone de cada registro na linha; o sono vira uma barra
// proporcional à duração). Tocar num registro abre a edição.
import { type CSSProperties } from 'react';
import { dataBr, horaCurta, nomeDia, textoDuracao } from '../lib/datas';
import { alturaSono, detalheSemHora, fitaDoDia, textoFimSono, type ItemDia } from '../lib/historico-dias';
import { descrever, resumoDia } from '../lib/registros';
import type { Registro } from '../lib/tipos';
import { ItemDeslizavel } from './deslize-item';
import { LinhaTempo } from './painel';
import { Selo } from './ui';
import '../estilos/historico.css';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function DiaHistorico({
  dia,
  hoje,
  agora,
  registrosDoDia,
  itens,
  vazio,
  ordem,
  alvo,
  legenda,
  nomeDe,
  aoEditar,
  aoApagar,
}: {
  dia: string;
  hoje: string;
  agora: Date;
  /** Todos os registros que tocam o dia (para o resumo e a fita, sem o filtro) */
  registrosDoDia: Registro[];
  /** Os itens da linha do tempo (já filtrados) */
  itens: ItemDia[];
  /** Texto quando o dia não tem itens */
  vazio: string;
  /** Posição na tela (atraso da animação de entrada) */
  ordem: number;
  /** Dia escolhido em "Ir para a data" (ganha destaque) */
  alvo: boolean;
  /** Mostra a legenda das cores na fita (só no primeiro dia) */
  legenda?: boolean;
  nomeDe: (id: string) => string;
  aoEditar: (r: Registro) => void;
  /** Deslizar o item até o fim (ou tocar em "Apagar") */
  aoApagar: (r: Registro) => void;
}) {
  const nome = nomeDia(dia, hoje);
  const relativo = nome === 'Hoje' || nome === 'Ontem';
  const r = resumoDia(registrosDoDia, dia, agora);
  // Dia sem mamada, fralda nem sono: sem resumo nem fita (só a lista, se houver algo)
  const temAlgo = r.alimentacoes + r.fraldas + r.sonoMs > 0;
  const fita = temAlgo ? fitaDoDia(registrosDoDia, dia, agora) : null;
  const estilo = { '--i': Math.min(ordem, 6) } as CSSProperties;

  return (
    <section id={`hist-dia-${dia}`} className={`cartao hist-dia ${alvo ? 'alvo' : ''}`} style={estilo} aria-label={relativo ? `${nome}, ${dataBr(dia)}` : nome}>
      <header className="hist-cab">
        <h2>{nome}</h2>
        <span className="hist-data">{relativo ? dataBr(dia).slice(0, 5) : ''}</span>
      </header>

      {temAlgo ? (
        <>
          <ul className="hist-resumo" aria-label="Resumo do dia">
            <li className="t-mamada">
              <i aria-hidden="true" />
              <strong>{r.alimentacoes}</strong> {r.alimentacoes === 1 ? 'alimentação' : 'alimentações'}
            </li>
            {r.peitoMs > 0 && (
              <li className="t-mamada">
                <i aria-hidden="true" />
                peito <strong>{textoDuracao(r.peitoMs)}</strong>
              </li>
            )}
            {r.ml > 0 && (
              <li className="t-mamadeira">
                <i aria-hidden="true" />
                <strong>{r.ml}</strong> ml
              </li>
            )}
            <li className="t-fralda">
              <i aria-hidden="true" />
              <strong>{r.fraldas}</strong> {r.fraldas === 1 ? 'fralda' : 'fraldas'}
            </li>
            {r.sonoMs > 0 && (
              <li className="t-sono">
                <i aria-hidden="true" />
                <strong>{textoDuracao(r.sonoMs)}</strong> de sono
              </li>
            )}
          </ul>
          {fita && (
            <div
              className={`hist-fita ${legenda ? 'com-legenda' : ''}`}
              role="img"
              aria-label={`Linha do tempo de ${nome}: ${plural(fita.sono.length, 'sono', 'sonos')}, ${plural(fita.alimentacoes.length, 'alimentação', 'alimentações')} e ${plural(fita.fraldas.length, 'fralda', 'fraldas')} ao longo das 24 horas`}
            >
              <LinhaTempo sono={fita.sono} alimentacoes={fita.alimentacoes} fraldas={fita.fraldas} marcas={fita.marcas} agoraFracao={fita.agoraFracao} />
            </div>
          )}
        </>
      ) : null}

      {itens.length ? (
        <ol className="hist-linha">
          {itens.map((x, k) => (
            <ItemLinha key={`${x.r.id}${x.continuacao ? '-c' : ''}`} item={x} dia={dia} agora={agora} ordem={k} nomeDe={nomeDe} aoEditar={aoEditar} aoApagar={aoApagar} />
          ))}
        </ol>
      ) : (
        <p className="mudo hist-vazio">{vazio}</p>
      )}
    </section>
  );
}

function ItemLinha({
  item,
  dia,
  agora,
  ordem,
  nomeDe,
  aoEditar,
  aoApagar,
}: {
  item: ItemDia;
  dia: string;
  agora: Date;
  ordem: number;
  nomeDe: (id: string) => string;
  aoEditar: (r: Registro) => void;
  aoApagar: (r: Registro) => void;
}) {
  const { r } = item;
  const d = descrever(r, agora);
  const sono = r.tipo === 'sono';
  const duracao = sono ? (item.continuacao ? item.sonoMs : (r.fim ? new Date(r.fim).getTime() : agora.getTime()) - new Date(r.inicio).getTime()) : 0;
  const detalhe = sono ? textoFimSono(item, dia) : detalheSemHora(d.detalhe);
  const partes = [detalhe, r.observacao, r.criado_por ? nomeDe(r.criado_por) : null].filter(Boolean);
  const titulo = item.continuacao ? `Sono · ${textoDuracao(item.sonoMs)} neste dia` : d.titulo;
  const hora = item.continuacao ? '00:00' : horaCurta(r.inicio);
  const estilo = { '--j': Math.min(ordem, 12), ...(sono ? { minHeight: alturaSono(duracao) } : {}) } as CSSProperties;
  const classes = ['hist-item', `t-${r.tipo}`, sono ? 'sono' : '', item.continuacao ? 'continuacao' : '', item.emAndamento && sono ? 'andamento' : ''].filter(Boolean).join(' ');

  return (
    // Deslizar para a esquerda revela Editar e Apagar; o toque simples continua abrindo a edição
    <ItemDeslizavel aoEditar={() => aoEditar(r)} aoApagar={() => aoApagar(r)}>
      <button type="button" className={classes} style={estilo} onClick={() => aoEditar(r)}>
        <span className="hist-trilho" aria-hidden="true">
          {sono && <span className="hist-barra" />}
          <span className="hist-icone">
            <Selo tipo={r.tipo} />
          </span>
        </span>
        <span className="hist-hora">{hora}</span>
        <span className="hist-texto">
          <span className="hist-titulo">{titulo}</span>
          {partes.length > 0 && <span className="hist-detalhe">{partes.join(' · ')}</span>}
        </span>
      </button>
    </ItemDeslizavel>
  );
}
