// Cartão "Mamadas de hoje": hora e lado da última, quantas hoje, uma bolinha por
// mamada e o ritmo do bebê. Nada de duração; só informação, nunca cobrança.
import { useMemo, useState, type CSSProperties } from 'react';
import '../estilos/mamadas.css';
import { horaCurta } from '../lib/datas';
import { alimentacoesDoDia, contagemDoDia, haCurto, ladoOposto, nomeLado, REFERENCIA_OMS, ritmoEsperado, textoAlimentacao, textoPeito, textoSemAlimentar, ladosDoRegistro, type AlimentacaoDoDia } from '../lib/hoje';
import { ultimaAlimentacao } from '../lib/registros';
import type { Lado, Registro } from '../lib/tipos';
import { NumeroAnimado } from './numero-animado';

const MAX_BOLINHAS = 14;
const contagem = (n: number) => String(Math.round(n));

const letra = (a: AlimentacaoDoDia) => (a.tipo === 'mamadeira' ? '' : a.lados.length === 2 ? 'ED' : (a.lados[0] ?? ''));

function Bolinha({ a, ativa, aoTocar }: { a: AlimentacaoDoDia; ativa: boolean; aoTocar: () => void }) {
  const texto = textoAlimentacao(a);
  return (
    <button type="button" className={`mm-bolinha ${a.tipo === 'mamadeira' ? 'mm-mamadeira' : 'mm-peito'} ${ativa ? 'mm-ativa' : ''}`} onClick={aoTocar} aria-label={texto} aria-pressed={ativa}>
      {letra(a)}
    </button>
  );
}

export function MamadasHoje({ registros, agora, hoje, nascimento }: { registros: Registro[]; agora: Date; hoje: string; nascimento: string | null }) {
  const minuto = Math.floor(agora.getTime() / 60_000);
  const [aberta, setAberta] = useState<string | null>(null);
  const d = useMemo(() => {
    const quando = new Date(minuto * 60_000);
    const itens = alimentacoesDoDia(registros, hoje);
    const ultima = ultimaAlimentacao(registros);
    let ultimoPeito: Registro | null = null;
    for (const r of registros) if (r.tipo === 'mamada' && ladosDoRegistro(r).length && (!ultimoPeito || new Date(r.inicio) > new Date(ultimoPeito.inicio))) ultimoPeito = r;
    const segs = ultimoPeito && ultimoPeito.tipo === 'mamada' ? ultimoPeito.dados.segmentos : [];
    const proximo: Lado | null = segs.length ? ladoOposto(segs[segs.length - 1].lado) : null;
    return { itens, c: contagemDoDia(itens), ultima, proximo, ritmo: ritmoEsperado(registros, hoje, quando, nascimento), aviso: textoSemAlimentar(ultima?.inicio ?? null, quando), quando };
  }, [registros, hoje, nascimento, minuto]);

  const { itens, c, ultima, ritmo } = d;
  const escondidas = Math.max(0, itens.length - MAX_BOLINHAS);
  const feitas = itens.slice(escondidas);
  const vazias = Math.max(0, Math.min(ritmo.faltam, MAX_BOLINHAS - feitas.length));
  const selecionada = feitas.find((a) => a.id === aberta) ?? null;

  const ultimaTexto = ultima
    ? ultima.tipo === 'mamada'
      ? textoPeito(ladosDoRegistro(ultima))
      : Number(ultima.dados.ml)
        ? `mamadeira ${Number(ultima.dados.ml)} ml`
        : 'mamadeira'
    : null;
  const partes = [c.peito ? `esquerdo ${c.esquerdo} · direito ${c.direito}` : null, c.mamadeiras ? `mamadeira ${c.mamadeiras}` : null].filter(Boolean);

  return (
    <section className="cartao mm-cartao" aria-label="Mamadas de hoje">
      {/* a. Última mamada */}
      <div className="mm-bloco">
        <span className="mm-rotulo">Última mamada</span>
        {ultima ? (
          <>
            <div className="mm-ultima">
              <span className="mm-hora">{horaCurta(ultima.inicio)}</span>
              <span className="mm-ultima-txt">
                {haCurto(ultima.inicio, d.quando)} · {ultimaTexto}
              </span>
            </div>
            {d.proximo && (
              <p className="mm-proximo">
                Próxima: comece pelo <strong>{nomeLado(d.proximo)}</strong>
              </p>
            )}
          </>
        ) : (
          <p className="mm-vazio">Nenhuma registrada ainda.</p>
        )}
      </div>

      {/* b. Hoje */}
      <div className="mm-bloco mm-hoje">
        <span className="mm-rotulo">Hoje</span>
        <div className="mm-total">
          <span className="mm-numero">
            <NumeroAnimado valor={c.total} formatar={contagem} chave="hoje:mamadas" />
          </span>
          <span className="mm-total-txt">{c.total === 1 ? 'mamada' : 'mamadas'}</span>
        </div>
        {partes.length > 0 && <p className="mm-partes">{partes.join(' · ')}</p>}

        {/* c. Bolinhas */}
        <div className="mm-bolinhas" role="group" aria-label="Uma bolinha para cada mamada de hoje">
          {escondidas > 0 && <span className="mm-mais">+{escondidas}</span>}
          {feitas.map((a) => (
            <Bolinha key={a.id} a={a} ativa={a.id === aberta} aoTocar={() => setAberta(a.id === aberta ? null : a.id)} />
          ))}
          {Array.from({ length: vazias }, (_, i) => (
            <span key={`v${i}`} className="mm-bolinha mm-vazia" aria-hidden="true" style={{ '--mm-i': i } as CSSProperties} />
          ))}
        </div>
        <p className="mm-toque" aria-live="polite">
          {selecionada ? textoAlimentacao(selecionada) : feitas.length ? 'Toque numa bolinha para ver a hora.' : ' '}
        </p>
      </div>

      {/* d. Ritmo */}
      <div className="mm-bloco mm-ritmo">
        {ritmo.fonte === 'proprio' ? (
          <p>
            No ritmo {ritmo.dias === 1 ? 'do último dia' : `dos últimos ${ritmo.dias} dias`}: cerca de <strong>{ritmo.esperado} mamadas por dia</strong>
            {ritmo.faltam > 0 ? ` · ${ritmo.faltam === 1 ? 'falta 1' : `faltam ${ritmo.faltam}`} até o fim do dia` : ' · hoje já está no ritmo'}
          </p>
        ) : (
          <p>
            Referência da OMS: a maioria dos bebês mama de <strong>{REFERENCIA_OMS.min} a {REFERENCIA_OMS.max} vezes</strong> em 24 horas (livre demanda, sem horário fixo).
          </p>
        )}
      </div>

      {/* e. Aviso discreto */}
      {d.aviso && <p className="mm-aviso">{d.aviso}</p>}

      <p className="mm-fontes">OMS · SBP · Ministério da Saúde: livre demanda. Dúvidas? Fale com o pediatra.</p>
    </section>
  );
}
