// Quem fez o quê: divisão dos cuidados da semana entre os responsáveis (cartão do Hoje).
// Uma barra empilhada por categoria (cada pedaço é uma pessoa, na cor do selo dela),
// os números sempre escritos ao lado e uma frase carinhosa. Tocar numa linha abre o detalhe.
import { useMemo, useState, type CSSProperties } from 'react';
import { useDados } from '../dados/contexto';
import { dataBr } from '../lib/datas';
import { CATEGORIAS, contarDivisao, fraseDivisao, type CategoriaDivisao, type DetalhePessoa, type LinhaDivisao } from '../lib/divisao';
import type { TipoRegistro } from '../lib/tipos';
import { classeCor, usePessoas, type Pessoa } from './quem';

const NOMES_TIPO: Record<TipoRegistro, [string, string]> = {
  mamada: ['mamada', 'mamadas'],
  mamadeira: ['mamadeira', 'mamadeiras'],
  fralda: ['fralda', 'fraldas'],
  sono: ['sono', 'sonos'],
  remedio: ['remédio', 'remédios'],
  temperatura: ['temperatura', 'temperaturas'],
  extracao: ['extração', 'extrações'],
  refeicao: ['refeição', 'refeições'],
};

const qtd = (n: number, [um, varios]: [string, string]) => `${n}\u00a0${n === 1 ? um : varios}`;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** O que o detalhe conta além do número (por categoria) */
function extra(chave: CategoriaDivisao, d: DetalhePessoa): string {
  if (!d.n) return '';
  if (chave === 'madrugada') return [d.mamadas && qtd(d.mamadas, ['no peito', 'no peito']), d.mamadeiras && qtd(d.mamadeiras, NOMES_TIPO.mamadeira)].filter(Boolean).join('\u00a0· ');
  if (chave === 'fralda') return d.coco ? `${d.coco} com cocô` : 'só xixi';
  if (chave === 'total')
    return (Object.entries(d.porTipo) as [TipoRegistro, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => qtd(n, NOMES_TIPO[t]))
      .join('\u00a0· ');
  return '';
}

const nomeVisivel = (p: Pessoa) => (p.voce ? `${p.nome} (você)` : p.nome);

function Linha({ linha, pessoas, aberta, aoTocar }: { linha: LinhaDivisao; pessoas: Pessoa[]; aberta: boolean; aoTocar: () => void }) {
  const cat = CATEGORIAS.find((c) => c.chave === linha.chave)!;
  const idDetalhe = `quem-det-${linha.chave}`;
  const resumo = pessoas.map((p) => `${p.nome} ${linha.por[p.id]?.n ?? 0}`).join(', ');
  return (
    <li className={`quem-linha ${aberta ? 'aberta' : ''}`}>
      <button type="button" className="quem-linha-botao" aria-expanded={aberta} aria-controls={idDetalhe} onClick={aoTocar}>
        <span className="quem-linha-cab">
          <span className="quem-cat">
            {cat.titulo} <span className="quem-sub">{cat.sub}</span>
          </span>
          <span className="quem-total">{linha.total}</span>
        </span>
        <span className="quem-barra" role="img" aria-label={linha.total ? `${cat.titulo}: ${resumo}, de ${linha.total}` : `${cat.titulo}: nenhum registro`}>
          {linha.total > 0 &&
            pessoas.map((p) => {
              const n = linha.por[p.id]?.n ?? 0;
              return n ? <span key={p.id} className={`quem-pedaco ${classeCor(p.cor)}`} style={{ flexGrow: n } as CSSProperties} /> : null;
            })}
        </span>
        <span className="quem-nums" aria-hidden="true">
          {linha.total > 0
            ? pessoas.map((p) => (
                <span key={p.id} className="quem-num">
                  <i className={`quem-ponto ${classeCor(p.cor)}`} />
                  {p.nome} <b>{linha.por[p.id]?.n ?? 0}</b>
                </span>
              ))
            : <span className="quem-num mudo">Nenhum registro</span>}
        </span>
      </button>
      {aberta && (
        <div className="quem-detalhe" id={idDetalhe}>
          {linha.total === 0 ? (
            <p className="mudo">Nada registrado nesta categoria nos últimos 7 dias.</p>
          ) : (
            <ul>
              {pessoas.map((p) => {
                const d = linha.por[p.id];
                const ex = d ? extra(linha.chave, d) : '';
                return (
                  <li key={p.id}>
                    <i className={`quem-ponto ${classeCor(p.cor)}`} aria-hidden="true" />
                    <span className="quem-det-texto">
                      <span>
                        <b>{nomeVisivel(p)}</b>: {d?.n ?? 0} de {linha.total} ({pct(d?.n ?? 0, linha.total)}%)
                      </span>
                      {ex && <span className="quem-det-extra">{ex}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Quem fez o quê: divisão da semana entre os responsáveis. Só com 2+ pessoas na família. */
export function DivisaoDaSemana() {
  const { registros, hoje, bebe } = useDados();
  const pessoas = usePessoas();
  const [aberta, setAberta] = useState<CategoriaDivisao | null>(null);
  const ids = useMemo(() => pessoas.map((p) => p.id), [pessoas]);
  const div = useMemo(() => contarDivisao(registros, ids, hoje), [registros, ids, hoje]);
  const total = div.linhas.find((l) => l.chave === 'total')!;
  if (pessoas.length < 2 || total.total === 0) return null;
  const frase = fraseDivisao(div, pessoas, bebe?.nome?.trim() || 'o bebê');

  return (
    <section className="cartao quem-divisao" aria-label="Divisão da semana">
      <div className="cartao-cab">
        <h2>Divisão da semana</h2>
        <span className="mudo quem-janela">
          {dataBr(div.de).slice(0, 5)} a {dataBr(div.ate).slice(0, 5)}
        </span>
      </div>
      <p className="quem-frase">{frase}</p>
      <ul className="quem-legenda" aria-label="Quem é cada cor">
        {pessoas.map((p) => (
          <li key={p.id}>
            <span className={`quem-selo ${classeCor(p.cor)} ${p.inicial.length > 1 ? 'duas' : ''}`} aria-hidden="true">
              {p.inicial}
            </span>
            {nomeVisivel(p)}
          </li>
        ))}
      </ul>
      <ul className="quem-linhas">
        {div.linhas.map((l) => (
          <Linha key={l.chave} linha={l} pessoas={pessoas} aberta={aberta === l.chave} aoTocar={() => setAberta((a) => (a === l.chave ? null : l.chave))} />
        ))}
      </ul>
      {div.semAutor > 0 && (
        <p className="mudo quem-nota">
          {div.semAutor === 1 ? '1 registro sem o nome de quem fez ficou de fora.' : `${div.semAutor} registros sem o nome de quem fez ficaram de fora.`}
        </p>
      )}
    </section>
  );
}
