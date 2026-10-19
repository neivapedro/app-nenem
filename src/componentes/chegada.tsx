import { useState } from 'react';
import { useDados } from '../dados/contexto';
import { CUIDADOS, FONTES_CHEGADA, itemFamilia, PESSOAS, RECOMENDACOES, textoParaFamilia, TOTAL_ITENS, VACINAS, type Pessoa, type VacinaFamilia } from '../lib/chegada';
import { idFixo } from '../lib/ids';
import type { Tarefa } from '../lib/tipos';
import { Icone } from './ui';

/** Quantas vacinas da família já foram conferidas (marcadas por qualquer um dos dois) */
export function useProgressoFamilia(): { feitas: number; total: number } {
  const { tarefas } = useDados();
  const feitas = tarefas.filter((t) => t.item_id?.startsWith('casulo:') && t.feito_em).length;
  return { feitas: Math.min(feitas, TOTAL_ITENS), total: TOTAL_ITENS };
}

export function SecaoChegada() {
  const { tarefas, membro, usuario, gravar, bebe, mostrarAviso, nomeDe } = useDados();
  const [msg, setMsg] = useState<string | null>(null);
  const { feitas, total } = useProgressoFamilia();
  const nomeBebe = bebe?.nome?.trim().split(' ')[0] || 'bebê';
  const porItem = new Map(tarefas.filter((t) => t.item_id).map((t) => [t.item_id!, t]));
  if (!membro) return null;

  const tarefaDe = (p: Pessoa, v: VacinaFamilia): Tarefa =>
    porItem.get(itemFamilia(p, v)) ?? {
      id: idFixo(`${membro.familia_id}:tarefa:${itemFamilia(p, v)}`),
      familia_id: membro.familia_id,
      criado_por: usuario?.id ?? null,
      item_id: itemFamilia(p, v),
      titulo: null,
      data: null,
      feito_em: null,
      observacao: null,
    };

  async function enviar() {
    setMsg(null);
    const texto = textoParaFamilia(nomeBebe);
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        mostrarAviso({ texto: 'Mensagem copiada: cole no grupo da família' });
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(texto);
        mostrarAviso({ texto: 'Mensagem copiada: cole no grupo da família' });
      } catch {
        setMsg(texto);
      }
    }
  }

  return (
    <div className="pilha">
      <section className="cartao pilha-p chegada-heroi">
        <span className="cofrinho-emoji" aria-hidden="true">
          🛡️
        </span>
        <h2>{bebe?.nascimento ? `Os primeiros meses do ${nomeBebe}` : `Antes de o ${nomeBebe} chegar`}</h2>
        <p className="texto-2">
          O recém-nascido começa a ser vacinado aos poucos: coqueluche aos 2 meses, gripe aos 6, sarampo aos 12. Até lá, a proteção vem da mãe (na gestação) e de quem convive com ele. É a <strong>estratégia casulo</strong>: todo mundo em volta vacinado, de preferência até 2 semanas antes do nascimento.
        </p>
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <span className="texto-2">
            {feitas} de {total} conferidas
          </span>
        </div>
        <div className="progresso" aria-hidden="true">
          <span style={{ width: `${(feitas / total) * 100}%` }} />
        </div>
        <button className="botao primario" onClick={() => void enviar()}>
          <Icone nome="compartilhar" /> Enviar a lista para a família
        </button>
        {msg && <textarea className="campo" readOnly value={msg} rows={8} />}
        <p className="mudo">Leve a caderneta de vacinação de cada um ao posto (UBS) ou à clínica: o profissional confere o que falta. SUS = de graça no posto; particular = clínicas de vacinação.</p>
      </section>

      {PESSOAS.map((p) => {
        const lista = RECOMENDACOES[p.id];
        const ok = lista.filter((r) => tarefaDe(p.id, r.vacina).feito_em).length;
        return (
          <section key={p.id} className="cartao pilha-p" aria-label={p.nome}>
            <div className="linha" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <h2 style={{ margin: 0 }}>{p.nome}</h2>
              <span className={`etiqueta ${ok === lista.length ? 'bom' : ''}`}>
                {ok} de {lista.length}
              </span>
            </div>
            <p className="mudo" style={{ margin: 0 }}>
              {p.detalhe}
            </p>
            <div>
              {lista.map((r) => {
                const t = tarefaDe(p.id, r.vacina);
                return (
                  <label key={r.vacina} className="marcar" style={{ alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={!!t.feito_em}
                      onChange={() => gravar({ tipo: 'colecao', colecao: 'tarefas', dado: { ...t, feito_em: t.feito_em ? null : new Date().toISOString(), criado_por: usuario?.id ?? t.criado_por } })}
                    />
                    <span className="cresce">
                      <span className="doc-titulo">{VACINAS[r.vacina].nome}</span>
                      <span className="texto-2" style={{ display: 'block' }}>
                        {r.texto}
                      </span>
                      {t.feito_em && t.criado_por && (
                        <span className="mudo" style={{ display: 'block' }}>
                          Conferido por {nomeDe(t.criado_por)}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}

      <details className="cartao ajuda">
        <summary>Por que cada vacina importa para o {nomeBebe}</summary>
        <div className="pilha-p" style={{ marginTop: 10 }}>
          {Object.values(VACINAS).map((v) => (
            <p key={v.id} className="texto-2" style={{ margin: 0 }}>
              <strong>{v.nome}:</strong> {v.porque}
            </p>
          ))}
        </div>
      </details>

      <h2 style={{ margin: '8px 0 0' }}>Cuidados essenciais</h2>
      {CUIDADOS.map((c) => (
        <details key={c.id} className={`cartao ajuda ${c.id === 'alerta-bebe' ? 'cuidado-alerta' : ''}`} open={c.id === 'alerta-bebe'}>
          <summary>
            {c.emoji} {c.titulo}
          </summary>
          <ul className="lista-cuidados">
            {c.itens.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mudo" style={{ margin: 0 }}>
            Fonte: {c.fonte}
          </p>
        </details>
      ))}

      <section className="cartao pilha-p">
        <h2>Fontes</h2>
        {FONTES_CHEGADA.map((f) => (
          <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="texto-2">
            {f.nome}
          </a>
        ))}
        <p className="mudo">Informação de orientação geral (out/2026). A indicação de cada pessoa, principalmente com doenças crônicas ou alergias, é do médico ou da sala de vacina.</p>
      </section>
    </div>
  );
}
