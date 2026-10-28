/*
 * Registro rápido: segurar um botão de registro do Hoje abre um menu com
 * atalhos de um toque (os volumes de mamadeira mais usados, xixi/cocô,
 * dormiu/acordou agora, peito E/D...). Aqui ficam as contas (funções puras):
 * quais atalhos mostrar e que registro cada um cria (e como desfazer).
 */
import type { Operacao } from '../dados/fila';
import { horaCurta, textoDuracao } from './datas';
import { emAndamento, iniciarMamada, iniciarSono, finalizarSono, NOME_LADO, outroLado, textoFralda, ultimoDoTipo, ultimoLado, validarRegistro } from './registros';
import { remedioEmUso } from './saude';
import type { ConteudoMamadeira, Lado, Registro, RegistroDe, Remedio } from './tipos';

export type TipoAtalho = 'mamada' | 'mamadeira' | 'fralda' | 'sono' | 'remedio' | 'extracao';

export type AcaoAtalho =
  | { tipo: 'mamadeira'; ml: number; conteudo: ConteudoMamadeira }
  | { tipo: 'fralda'; xixi: boolean; coco: boolean }
  | { tipo: 'dormiu'; haMin: number }
  | { tipo: 'acordou'; haMin: number }
  | { tipo: 'mamada'; lado: Lado }
  | { tipo: 'remedio'; remedio_id: string; nome: string; dose: string | null }
  | { tipo: 'extracao'; ml_e: number; ml_d: number };

export interface Atalho {
  id: string;
  rotulo: string;
  detalhe?: string;
  /** Emoji ou nome de ícone do app (ui.tsx) */
  icone?: string;
  emoji?: string;
  acao: AcaoAtalho;
}

type Base = Pick<Registro, 'id' | 'familia_id' | 'bebe_id' | 'criado_por'>;

const DIA = 86_400_000;
const NOME_CONTEUDO: Record<ConteudoMamadeira, string> = { materno: 'leite materno', formula: 'fórmula' };
/** Quantidades para completar quando há pouco histórico (o mais comum primeiro) */
const ML_PADRAO = [90, 120, 60, 150];

export interface MamadeiraUsada {
  ml: number;
  conteudo: ConteudoMamadeira;
  vezes: number;
  /** ms da mais recente com essa combinação */
  ultima: number;
}

/**
 * Combinações (ml + leite) mais usadas nos últimos `dias` dias, da mais usada para a menos;
 * empate = a mais recente primeiro. A última mamadeira dada sempre entra.
 */
export function mamadeirasMaisUsadas(registros: Registro[], agora: Date, n = 3, dias = 21): MamadeiraUsada[] {
  const desde = agora.getTime() - dias * DIA;
  const mapa = new Map<string, MamadeiraUsada>();
  for (const r of registros) {
    if (r.tipo !== 'mamadeira' || !(r.dados.ml > 0)) continue;
    const t = new Date(r.inicio).getTime();
    if (!(t >= desde && t <= agora.getTime() + 5 * 60_000)) continue;
    const chave = `${r.dados.ml}|${r.dados.conteudo}`;
    const atual = mapa.get(chave);
    if (atual) {
      atual.vezes++;
      atual.ultima = Math.max(atual.ultima, t);
    } else mapa.set(chave, { ml: r.dados.ml, conteudo: r.dados.conteudo, vezes: 1, ultima: t });
  }
  const todas = [...mapa.values()].sort((a, b) => b.vezes - a.vezes || b.ultima - a.ultima);
  const lista = todas.slice(0, n);
  const maisRecente = [...todas].sort((a, b) => b.ultima - a.ultima)[0];
  if (maisRecente && !lista.includes(maisRecente) && lista.length) lista[lista.length - 1] = maisRecente;
  return lista;
}

/** Atalhos de mamadeira: os mais usados, completados com quantidades comuns no leite de sempre */
export function atalhosMamadeira(registros: Registro[], agora: Date, n = 3): Atalho[] {
  const usadas = mamadeirasMaisUsadas(registros, agora, n);
  const ultima = ultimoDoTipo(registros, 'mamadeira');
  const conteudo: ConteudoMamadeira = ultima?.dados.conteudo ?? 'materno';
  const itens: { ml: number; conteudo: ConteudoMamadeira; detalhe?: string }[] = usadas.map((u) => ({
    ml: u.ml,
    conteudo: u.conteudo,
    detalhe: ultima && ultima.dados.ml === u.ml && ultima.dados.conteudo === u.conteudo ? 'igual à última' : `${u.vezes}× nas últimas 3 semanas`,
  }));
  for (const ml of ML_PADRAO) {
    if (itens.length >= n) break;
    if (!itens.some((i) => i.ml === ml && i.conteudo === conteudo)) itens.push({ ml, conteudo });
  }
  return itens.map((i) => ({
    id: `mamadeira-${i.ml}-${i.conteudo}`,
    rotulo: `${i.ml} ml de ${NOME_CONTEUDO[i.conteudo]}`,
    detalhe: i.detalhe,
    icone: 'mamadeira',
    acao: { tipo: 'mamadeira', ml: i.ml, conteudo: i.conteudo },
  }));
}

export interface ContextoAtalhos {
  registros: Registro[];
  agora: Date;
  remedios?: Remedio[];
  /** AAAA-MM-DD */
  hoje?: string;
}

export function atalhosPara(tipo: TipoAtalho, ctx: ContextoAtalhos): Atalho[] {
  const { registros, agora } = ctx;
  if (tipo === 'mamadeira') return atalhosMamadeira(registros, agora);
  if (tipo === 'fralda')
    return [
      { id: 'fralda-xixi', rotulo: 'Xixi', emoji: '💧', acao: { tipo: 'fralda', xixi: true, coco: false } },
      { id: 'fralda-coco', rotulo: 'Cocô', emoji: '💩', acao: { tipo: 'fralda', xixi: false, coco: true } },
      { id: 'fralda-ambos', rotulo: 'Xixi e cocô', emoji: '💧💩', acao: { tipo: 'fralda', xixi: true, coco: true } },
    ];
  if (tipo === 'sono') {
    const s = emAndamento(registros).sono;
    if (s) {
      const dur = agora.getTime() - new Date(s.inicio).getTime();
      const lista: Atalho[] = [{ id: 'acordou-0', rotulo: 'Acordou agora', detalhe: `sono de ${textoDuracao(Math.max(dur, 60_000))}`, icone: 'sono', acao: { tipo: 'acordou', haMin: 0 } }];
      if (dur > 20 * 60_000) lista.push({ id: 'acordou-15', rotulo: 'Acordou há 15 min', detalhe: `às ${horaCurta(new Date(agora.getTime() - 15 * 60_000).toISOString())}`, icone: 'sono', acao: { tipo: 'acordou', haMin: 15 } });
      return lista;
    }
    return [
      { id: 'dormiu-0', rotulo: 'Começou a dormir agora', detalhe: 'o cronômetro do sono começa', icone: 'sono', acao: { tipo: 'dormiu', haMin: 0 } },
      { id: 'dormiu-15', rotulo: 'Dormiu há 15 min', detalhe: `conta desde ${horaCurta(new Date(agora.getTime() - 15 * 60_000).toISOString())}`, icone: 'sono', acao: { tipo: 'dormiu', haMin: 15 } },
    ];
  }
  if (tipo === 'mamada') {
    if (emAndamento(registros).mamada) return [];
    const ultimo = ultimoLado(registros);
    const primeiro: Lado = ultimo ? outroLado(ultimo) : 'E';
    return ([primeiro, outroLado(primeiro)] as Lado[]).map((l) => ({
      id: `mamada-${l}`,
      rotulo: `Peito ${NOME_LADO[l].toLowerCase()}`,
      detalhe: ultimo && l === primeiro ? `sugerido · terminou no ${ultimo} na última` : 'começa o cronômetro',
      icone: 'tocar',
      acao: { tipo: 'mamada', lado: l },
    }));
  }
  if (tipo === 'remedio') {
    const hoje = ctx.hoje ?? agora.toISOString().slice(0, 10);
    return (ctx.remedios ?? [])
      .filter((m) => remedioEmUso(m, hoje))
      .slice(0, 4)
      .map((m) => ({ id: `remedio-${m.id}`, rotulo: m.nome, detalhe: `${m.dose ? `${m.dose} · ` : ''}dose dada agora`, icone: 'remedio', acao: { tipo: 'remedio', remedio_id: m.id, nome: m.nome, dose: m.dose } }));
  }
  // Extração: as combinações mais repetidas no último mês
  const desde = agora.getTime() - 30 * DIA;
  const mapa = new Map<string, { e: number; d: number; vezes: number; ultima: number }>();
  for (const r of registros) {
    if (r.tipo !== 'extracao') continue;
    const t = new Date(r.inicio).getTime();
    if (t < desde || (r.dados.ml_e || 0) + (r.dados.ml_d || 0) <= 0) continue;
    const k = `${r.dados.ml_e}|${r.dados.ml_d}`;
    const a = mapa.get(k);
    if (a) {
      a.vezes++;
      a.ultima = Math.max(a.ultima, t);
    } else mapa.set(k, { e: r.dados.ml_e || 0, d: r.dados.ml_d || 0, vezes: 1, ultima: t });
  }
  return [...mapa.values()]
    .sort((a, b) => b.vezes - a.vezes || b.ultima - a.ultima)
    .slice(0, 2)
    .map((x) => ({
      id: `extracao-${x.e}-${x.d}`,
      rotulo: [x.e ? `${x.e} ml E` : '', x.d ? `${x.d} ml D` : ''].filter(Boolean).join(' + '),
      detalhe: `total ${x.e + x.d} ml · sem guardar no estoque`,
      icone: 'extracao',
      acao: { tipo: 'extracao', ml_e: x.e, ml_d: x.d },
    }));
}

export type ResultadoAtalho = { ok: true; ops: Operacao[]; texto: string; desfazer: Operacao[]; registro: Registro } | { ok: false; texto: string };

const excluir = (r: Registro): Operacao => ({ tipo: 'excluir', dado: { alvo: 'registro', id: r.id } });

/** O que salvar para um atalho (e o que fazer no "Desfazer"). Não grava nada. */
export function aplicarAtalho(acao: AcaoAtalho, ctx: { registros: Registro[]; base: Base; agora: Date }): ResultadoAtalho {
  const { registros, base, agora } = ctx;
  const iso = agora.toISOString();
  const simples = (r: Registro, texto: string): ResultadoAtalho => {
    const problema = validarRegistro(r, agora);
    if (problema) return { ok: false, texto: problema };
    return { ok: true, ops: [{ tipo: 'registro', dado: r }], texto, desfazer: [excluir(r)], registro: r };
  };
  switch (acao.tipo) {
    case 'mamadeira': {
      const r: RegistroDe<'mamadeira'> = { ...base, tipo: 'mamadeira', inicio: iso, fim: iso, observacao: null, dados: { ml: acao.ml, conteudo: acao.conteudo } };
      return simples(r, `Mamadeira registrada (${acao.ml} ml de ${NOME_CONTEUDO[acao.conteudo]})`);
    }
    case 'fralda': {
      const r: RegistroDe<'fralda'> = { ...base, tipo: 'fralda', inicio: iso, fim: iso, observacao: null, dados: { xixi: acao.xixi, coco: acao.coco, cor: null } };
      return simples(r, `Fralda registrada (${textoFralda(r.dados)})`);
    }
    case 'remedio': {
      const r: RegistroDe<'remedio'> = { ...base, tipo: 'remedio', inicio: iso, fim: iso, observacao: null, dados: { remedio_id: acao.remedio_id, nome: acao.nome, dose: acao.dose } };
      return simples(r, `Remédio registrado (${acao.nome})`);
    }
    case 'extracao': {
      const r: RegistroDe<'extracao'> = { ...base, tipo: 'extracao', inicio: iso, fim: iso, observacao: null, dados: { ml_e: acao.ml_e, ml_d: acao.ml_d } };
      return simples(r, `Extração registrada (${acao.ml_e + acao.ml_d} ml)`);
    }
    case 'mamada': {
      if (emAndamento(registros).mamada) return { ok: false, texto: 'Já tem uma mamada em andamento' };
      const r = iniciarMamada(base, acao.lado, agora);
      return { ok: true, ops: [{ tipo: 'registro', dado: r }], texto: `Mamada começou no peito ${NOME_LADO[acao.lado].toLowerCase()}`, desfazer: [excluir(r)], registro: r };
    }
    case 'dormiu': {
      if (emAndamento(registros).sono) return { ok: false, texto: 'O sono já está sendo contado' };
      const r = iniciarSono(base, new Date(agora.getTime() - acao.haMin * 60_000));
      return { ok: true, ops: [{ tipo: 'registro', dado: r }], texto: acao.haMin ? `Sono contando desde ${horaCurta(r.inicio)}` : 'Sono começou a contar', desfazer: [excluir(r)], registro: r };
    }
    case 'acordou': {
      const s = emAndamento(registros).sono;
      if (!s) return { ok: false, texto: 'Nenhum sono em andamento' };
      const ini = new Date(s.inicio).getTime();
      const fim = finalizarSono(s, new Date(Math.max(agora.getTime() - acao.haMin * 60_000, ini + 60_000)));
      const dur = new Date(fim.fim!).getTime() - ini;
      return { ok: true, ops: [{ tipo: 'registro', dado: fim }], texto: `Sono salvo (${textoDuracao(dur)})`, desfazer: [{ tipo: 'registro', dado: s }], registro: fim };
    }
  }
}
