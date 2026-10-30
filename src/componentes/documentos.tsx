import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useDados } from '../dados/contexto';
import { chaveDia, dataBr } from '../lib/datas';
import {
  CATEGORIAS,
  combinaBusca,
  formatoPadrao,
  guardado,
  KITS,
  MODELO_POR_ID,
  MODELOS,
  montarKit,
  naCarteira,
  NOME_CATEGORIA,
  nomeArquivo,
  situacaoValidade,
  SUGESTOES,
  tamanhoTexto,
  type FormatoCopia,
  type Kit,
  type ModeloDocumento,
} from '../lib/documentos';
import { traduzirErro } from '../lib/erros';
import { limpar, listaDocumentos, MontadorZip, planejarDocumentos } from '../lib/exportar';
import { idFixo } from '../lib/ids';
import type { ArquivoDocumento, CategoriaDocumento, Documento } from '../lib/tipos';
import { arquivoPdf, compartilhar, ehImagem, enviarFotoPronta, nomeGuardado, obterArquivo, paraPdf, prepararEEnviar, useUrlArquivo } from './doc-arquivos';
import { EditorFoto } from './doc-editor-foto';
import { useEstadoOffline } from './doc-offline';
import { Visualizador } from './doc-visualizador';
import { Ilustracao } from './ilustracoes';
import { Campo, Escolhas, Folha, Icone } from './ui';
import '../estilos/carteira.css';

const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const ehFoto = (a: ArquivoDocumento) => a.tipo.startsWith('image/');

function ordenar(docs: Documento[]): Documento[] {
  const ordemModelo = new Map(MODELOS.map((m, i) => [m.id, i]));
  const ordemCat = new Map(CATEGORIAS.map((c, i) => [c.id, i]));
  return [...docs].sort(
    (a, b) =>
      (ordemCat.get(a.categoria) ?? 9) - (ordemCat.get(b.categoria) ?? 9) ||
      (ordemModelo.get(a.modelo_id ?? '') ?? 99) - (ordemModelo.get(b.modelo_id ?? '') ?? 99) ||
      (b.data ?? '').localeCompare(a.data ?? '') ||
      a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }),
  );
}

/** Gera o comprovante de vacinação (PDF) com as doses marcadas no app */
async function gerarComprovanteVacinacao(dados: ReturnType<typeof useDados>): Promise<Uint8Array> {
  const { bebe, vacinas, documentos, hoje } = dados;
  if (!bebe) throw new Error('Cadastre o bebê primeiro.');
  const [{ modeloCarteiraVacinacao }, { montarCarteiraVacinacao }] = await Promise.all([import('../lib/carteira-vacinacao'), import('../lib/pdf-documentos')]);
  return montarCarteiraVacinacao(modeloCarteiraVacinacao(bebe, vacinas, documentos, hoje, new Date().toLocaleString('pt-BR')));
}

/** Estado comum dos botões que preparam um PDF e abrem o compartilhar */
function usePreparo() {
  const [preparando, setPreparando] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ arquivo: File; titulo: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function rodar(titulo: string, fazer: (passo: (t: string) => void) => Promise<File | File[]>) {
    setMsg(null);
    setPronto(null);
    try {
      setPreparando('Preparando…');
      const r = await fazer(setPreparando);
      const lista = Array.isArray(r) ? r : [r];
      setPreparando(null);
      if ((await compartilhar(lista, titulo)) === 'bloqueado' && lista.length === 1) setPronto({ arquivo: lista[0], titulo });
    } catch (e) {
      setPreparando(null);
      setMsg(traduzirErro(e));
    }
  }
  const botaoPronto = pronto && (
    <button className="botao" onClick={() => void compartilhar([pronto.arquivo], pronto.titulo)}>
      <Icone nome="compartilhar" /> Pronto: toque para enviar ou imprimir
    </button>
  );
  return { preparando, msg, setMsg, rodar, botaoPronto };
}

// ---------- Peças da tela ----------

function Miniatura({ doc, modelo }: { doc?: Documento; modelo?: ModeloDocumento }) {
  const primeiraFoto = doc?.arquivos.find(ehFoto)?.caminho ?? null;
  const url = useUrlArquivo(primeiraFoto);
  if (!doc && modelo)
    return (
      <span className="doc-miniatura falta">
        <Icone nome="mais" />
      </span>
    );
  if (url)
    return (
      <span className="doc-miniatura">
        <img src={url} alt="" loading="lazy" />
      </span>
    );
  return (
    <span className={`doc-miniatura ${doc && !doc.arquivos.length && doc.numero ? 'ok' : ''}`}>
      <Icone nome={doc?.arquivos.length ? 'documento' : 'check'} />
    </span>
  );
}

function EtiquetaValidade({ validade }: { validade: string | null }) {
  const { hoje } = useDados();
  const s = situacaoValidade(validade, hoje);
  if (!s || !validade) return null;
  if (s === 'vencido') return <span className="etiqueta ruim">Vencido em {dataBr(validade)}</span>;
  if (s === 'vence-logo') return <span className="etiqueta aviso">{validade === hoje ? 'Vence hoje' : `Vence em ${dataBr(validade)}`}</span>;
  return null;
}

function LinhaDocumento({ doc, aoAbrir }: { doc: Documento; aoAbrir: () => void }) {
  const partes = [doc.arquivos.length ? qtd(doc.arquivos.length, 'arquivo', 'arquivos') : doc.numero ? 'Só o número' : 'Sem arquivo', doc.data && dataBr(doc.data)].filter(Boolean);
  return (
    <button type="button" className="doc-linha" onClick={aoAbrir}>
      <Miniatura doc={doc} />
      <span className="cresce">
        <span className="doc-titulo">{doc.titulo}</span>
        <span className="texto-2">{partes.join(' · ')}</span> <EtiquetaValidade validade={doc.validade} />
      </span>
      <span className="seta" style={{ color: 'var(--texto-3)' }}>
        <Icone nome="seta" />
      </span>
    </button>
  );
}

function CopiarNumero({ numero }: { numero: string }) {
  const { mostrarAviso } = useDados();
  return (
    <button
      type="button"
      className="icone-botao"
      aria-label={`Copiar ${numero}`}
      onClick={() =>
        navigator.clipboard
          .writeText(numero)
          .then(() => mostrarAviso({ texto: 'Número copiado' }))
          .catch(() => mostrarAviso({ texto: numero }))
      }
    >
      <Icone nome="copiar" />
    </button>
  );
}

/** Cor de cada categoria na carteira (como os cartões da Carteira do iPhone) */
const COR_CARTEIRA: Record<CategoriaDocumento, string> = {
  identificacao: 'var(--c-fralda)',
  saude: 'var(--c-agenda)',
  exames: 'var(--c-mamadeira)',
  plano: 'var(--c-sono)',
  escola: 'var(--c-mamada)',
  viagem: 'color-mix(in srgb, var(--c-fralda) 55%, var(--c-agenda))',
  familia: 'color-mix(in srgb, var(--c-mamada) 60%, var(--c-mamadeira))',
  outros: 'color-mix(in srgb, var(--texto-3) 80%, var(--c-fralda))',
};

/** Cartão da carteira: faixa colorida com o nome (é o que aparece na pilha) e a foto do documento */
function CartaoCarteira({ doc, aoAbrir }: { doc: Documento; aoAbrir: () => void }) {
  const url = useUrlArquivo(doc.arquivos.find(ehFoto)?.caminho ?? null);
  return (
    <button type="button" className="cartao-carteira" style={{ '--cc': COR_CARTEIRA[doc.categoria] ?? COR_CARTEIRA.outros } as CSSProperties} onClick={aoAbrir} aria-label={`Mostrar ${doc.titulo}`}>
      <span className="cc-topo">
        <strong>{doc.titulo}</strong>
        <span>{NOME_CATEGORIA[doc.categoria]}</span>
      </span>
      <span className={`cc-corpo ${url ? 'com-foto' : ''}`}>
        {url ? <img src={url} alt="" /> : <Icone nome="documento" />}
      </span>
      {doc.numero && <span className="cc-numero">{doc.numero}</span>}
    </button>
  );
}

/** Carteira vazia: desenho simples e um convite curto */
function CarteiraVazia() {
  return (
    <div className="carteira-vazia">
      <Ilustracao nome="documentos" />
      <div className="cresce">
        <strong>Nenhum cartão ainda</strong>
        <p className="texto-2">SUS, plano e certidão entram aqui quando tiverem foto. Outros: abra e toque em “Pôr na carteira”.</p>
      </div>
    </div>
  );
}

function StatusOffline() {
  const e = useEstadoOffline();
  if (!e.total) return null;
  const tudo = e.guardados >= e.total;
  return (
    <p className={`doc-offline ${tudo ? 'ok' : ''}`}>
      <Icone nome="nuvem" />
      {tudo
        ? `Disponível sem internet neste celular (${qtd(e.total, 'arquivo', 'arquivos')}, ${tamanhoTexto(e.bytes)})`
        : e.sincronizando
          ? `Guardando cópia no celular para abrir sem internet: ${e.guardados} de ${e.total}…`
          : `Sem internet agora: ${e.guardados} de ${e.total} arquivos já estão no celular. O resto vem quando a conexão voltar.`}
    </p>
  );
}

// ---------- Editar / novo ----------

type Ajuste = { tipo: 'nova'; foto: File } | { tipo: 'existente'; indice: number; foto: Blob };

function FolhaEditar({ inicial, novo, aoFechar, aoSalvar }: { inicial: Documento; novo: boolean; aoFechar: () => void; aoSalvar: (d: Documento) => void }) {
  const { repo, gravar, mostrarAviso, setErro, documentos } = useDados();
  const [d, setD] = useState<Documento>(inicial);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  // Arquivos enviados nesta edição: se cancelar, saem do servidor
  const enviados = useRef(new Set<string>());
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const arquivosRef = useRef<HTMLInputElement>(null);
  const modelo = d.modelo_id ? MODELO_POR_ID.get(d.modelo_id) : undefined;

  const cancelar = () => {
    const sobra = [...enviados.current];
    if (sobra.length) void repo.excluirArquivos(sobra).catch(() => undefined);
    aoFechar();
  };

  const acrescentar = (novos: ArquivoDocumento[]) => {
    for (const a of novos) enviados.current.add(a.caminho);
    if (novos.length) setD((atual) => ({ ...atual, arquivos: [...atual.arquivos, ...novos] }));
  };

  async function adicionar(lista: FileList | null) {
    const arquivos = [...(lista ?? [])];
    if (!arquivos.length) return;
    setMsg(null);
    let ordem = d.arquivos.length;
    const novos: ArquivoDocumento[] = [];
    try {
      for (let i = 0; i < arquivos.length; i++) {
        setEnviando(arquivos.length > 1 ? `Enviando ${i + 1} de ${arquivos.length}…` : 'Enviando…');
        novos.push(await prepararEEnviar(repo, arquivos[i], ++ordem));
      }
    } catch (e) {
      setMsg(`${novos.length ? 'Parte dos arquivos foi enviada. ' : ''}Não deu para enviar: ${traduzirErro(e)}`);
    } finally {
      setEnviando(null);
      acrescentar(novos);
    }
  }

  /** Foto ajustada (recortada e endireitada): envia e entra no lugar certo */
  async function usarAjustada(blob: Blob) {
    const a = ajuste;
    setAjuste(null);
    if (!a) return;
    setEnviando('Enviando…');
    setMsg(null);
    try {
      if (a.tipo === 'nova') {
        if (blob === a.foto) acrescentar([await prepararEEnviar(repo, a.foto, d.arquivos.length + 1)]);
        else acrescentar([await enviarFotoPronta(repo, blob, nomeGuardado(a.foto, d.arquivos.length + 1))]);
      } else {
        const antigo = d.arquivos[a.indice];
        const novo = await enviarFotoPronta(repo, blob, antigo.nome);
        enviados.current.add(novo.caminho);
        if (enviados.current.has(antigo.caminho)) {
          enviados.current.delete(antigo.caminho);
          void repo.excluirArquivos([antigo.caminho]).catch(() => undefined);
        }
        setD((atual) => ({ ...atual, arquivos: atual.arquivos.map((x, i) => (i === a.indice ? novo : x)) }));
      }
    } catch (e) {
      setMsg(`Não deu para enviar: ${traduzirErro(e)}`);
    } finally {
      setEnviando(null);
    }
  }

  async function ajustarExistente(i: number) {
    try {
      setEnviando('Abrindo…');
      const blob = await obterArquivo(repo, d.arquivos[i].caminho);
      setAjuste({ tipo: 'existente', indice: i, foto: blob });
    } catch (e) {
      setMsg(traduzirErro(e));
    } finally {
      setEnviando(null);
    }
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const titulo = d.titulo.trim();
    if (!titulo) return setMsg('Dê um nome ao documento.');
    if (enviando) return setMsg('Espere terminar o envio dos arquivos.');
    // Junta o que o outro membro mudou nos arquivos enquanto a folha estava aberta:
    // os que ele acrescentou entram; os que ele tirou não voltam
    const agora = novo ? undefined : documentos.find((x) => x.id === d.id);
    const eraAntes = new Set(inicial.arquivos.map((a) => a.caminho));
    const nesta = new Set(d.arquivos.map((a) => a.caminho));
    let arquivos = d.arquivos;
    if (agora) {
      const existem = new Set(agora.arquivos.map((a) => a.caminho));
      arquivos = [
        ...d.arquivos.filter((a) => !eraAntes.has(a.caminho) || existem.has(a.caminho)),
        ...agora.arquivos.filter((a) => !eraAntes.has(a.caminho) && !nesta.has(a.caminho)),
      ];
    }
    const final: Documento = { ...d, titulo, numero: d.numero?.trim() || null, observacao: d.observacao?.trim() || null, arquivos };
    gravar({ tipo: 'colecao', colecao: 'documentos', dado: final });
    // Arquivos tirados ou trocados nesta edição saem do servidor
    const sairam = inicial.arquivos.filter((a) => !nesta.has(a.caminho)).map((a) => a.caminho);
    if (sairam.length) void repo.excluirArquivos(sairam).catch((err) => setErro(traduzirErro(err)));
    mostrarAviso({ texto: novo ? 'Documento guardado 📁' : 'Documento atualizado' });
    aoSalvar(final);
  }

  function mover(i: number) {
    if (i <= 0) return;
    const a = [...d.arquivos];
    [a[i - 1], a[i]] = [a[i], a[i - 1]];
    setD({ ...d, arquivos: a });
  }

  function tirar(i: number) {
    const a = d.arquivos[i];
    if (enviados.current.has(a.caminho)) {
      enviados.current.delete(a.caminho);
      void repo.excluirArquivos([a.caminho]).catch(() => undefined);
    }
    setD({ ...d, arquivos: d.arquivos.filter((_, j) => j !== i) });
  }

  return (
    <>
      <Folha titulo={novo ? 'Novo documento' : 'Editar documento'} aoFechar={cancelar}>
        <form className="pilha" onSubmit={salvar}>
          {modelo ? (
            <div>
              <div className="doc-titulo">{modelo.titulo}</div>
              <p className="texto-2">{modelo.dica}</p>
            </div>
          ) : (
            <>
              <Campo rotulo="Tipo" grupo>
                <div className="chips">
                  {CATEGORIAS.map((c) => (
                    <button key={c.id} type="button" className={`chip ${d.categoria === c.id ? 'ativo' : ''}`} onClick={() => setD({ ...d, categoria: c.id })}>
                      {c.nome}
                    </button>
                  ))}
                </div>
              </Campo>
              <Campo rotulo="Nome do documento">
                <input value={d.titulo} maxLength={200} onChange={(e) => setD({ ...d, titulo: e.target.value })} placeholder="Ex.: Receita do pediatra" autoCapitalize="sentences" />
              </Campo>
              {!d.titulo && SUGESTOES[d.categoria].length > 0 && (
                <div className="chips" aria-label="Sugestões">
                  {SUGESTOES[d.categoria].map((s) => (
                    <button key={s} type="button" className="chip" onClick={() => setD({ ...d, titulo: s })}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <Campo rotulo="Arquivos" grupo dica="Frente e verso? Tire uma foto de cada lado. Depois de tirar, o app pede para marcar as pontas do papel e endireita a foto.">
            {d.arquivos.length > 0 && (
              <div className="doc-arquivos" style={{ marginBottom: 8 }}>
                {d.arquivos.map((a, i) => (
                  <ArquivoTile
                    key={a.caminho}
                    arquivo={a}
                    ordem={i + 1}
                    aoTirar={() => tirar(i)}
                    aoSubir={i > 0 ? () => mover(i) : undefined}
                    aoAjustar={ehFoto(a) ? () => void ajustarExistente(i) : undefined}
                  />
                ))}
              </div>
            )}
            <div className="doc-botoes">
              <button type="button" className="botao" disabled={!!enviando} onClick={() => camera.current?.click()}>
                <Icone nome="camera" /> Tirar foto
              </button>
              <button type="button" className="botao" disabled={!!enviando} onClick={() => galeria.current?.click()}>
                <Icone nome="imagem" /> Galeria
              </button>
              <button type="button" className="botao" disabled={!!enviando} onClick={() => arquivosRef.current?.click()}>
                <Icone nome="pasta" /> Arquivos
              </button>
            </div>
            {enviando && <p className="mudo">{enviando}</p>}
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f && ehImagem(f)) setAjuste({ tipo: 'nova', foto: f });
              }}
            />
            <input
              ref={galeria}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const fs = e.target.files;
                // Uma foto só: já abre o ajuste; várias: envia direto (dá para ajustar cada uma depois)
                if (fs?.length === 1 && ehImagem(fs[0])) setAjuste({ tipo: 'nova', foto: fs[0] });
                else void adicionar(fs);
                e.target.value = '';
              }}
            />
            <input
              ref={arquivosRef}
              type="file"
              accept="application/pdf,.pdf,image/*"
              multiple
              hidden
              onChange={(e) => {
                void adicionar(e.target.files);
                e.target.value = '';
              }}
            />
          </Campo>

          {(modelo?.numero || !modelo) && (
            <Campo rotulo={modelo?.numero ?? 'Número (opcional)'} dica="Fica na lista de números para copiar rápido.">
              <input value={d.numero ?? ''} maxLength={100} onChange={(e) => setD({ ...d, numero: e.target.value })} inputMode={d.modelo_id === 'cpf' || d.modelo_id === 'cns' ? 'numeric' : 'text'} autoComplete="off" />
            </Campo>
          )}
          <div className="grade">
            <Campo rotulo="Data do documento">
              <input type="date" value={d.data ?? ''} onChange={(e) => setD({ ...d, data: e.target.value || null })} />
            </Campo>
            {(modelo?.validade || !modelo) && (
              <Campo rotulo="Validade (se tiver)">
                <input type="date" value={d.validade ?? ''} onChange={(e) => setD({ ...d, validade: e.target.value || null })} />
              </Campo>
            )}
          </div>
          <Campo rotulo="Anotação (opcional)">
            <textarea value={d.observacao ?? ''} maxLength={2000} onChange={(e) => setD({ ...d, observacao: e.target.value })} placeholder="Ex.: original na pasta azul do armário" />
          </Campo>
          {msg && (
            <div className="alerta erro" role="alert">
              {msg}
            </div>
          )}
          <button className="botao primario" disabled={!!enviando}>
            Salvar
          </button>
        </form>
      </Folha>
      {ajuste && <EditorFoto foto={ajuste.foto} aoCancelar={() => setAjuste(null)} aoPronto={(b) => void usarAjustada(b)} textoPular={ajuste.tipo === 'nova' ? 'Usar a foto como está' : undefined} />}
    </>
  );
}

function ArquivoTile({
  arquivo,
  ordem,
  aoTirar,
  aoSubir,
  aoAjustar,
  aoAbrir,
}: {
  arquivo: ArquivoDocumento;
  ordem: number;
  aoTirar?: () => void;
  aoSubir?: () => void;
  aoAjustar?: () => void;
  aoAbrir?: () => void;
}) {
  const url = useUrlArquivo(ehFoto(arquivo) ? arquivo.caminho : null);
  const conteudo = (
    <>
      {url ? (
        <img src={url} alt={arquivo.nome} loading="lazy" />
      ) : (
        <>
          <Icone nome={ehFoto(arquivo) ? 'imagem' : 'documento'} />
          <span className="nome">{arquivo.nome}</span>
          <span className="mudo">{tamanhoTexto(arquivo.tamanho)}</span>
        </>
      )}
      <span className="pagina">{ordem}</span>
    </>
  );
  if (aoTirar)
    return (
      <div className="doc-arquivo">
        <span className="acoes-arquivo">
          {aoAjustar && (
            <button type="button" onClick={aoAjustar} aria-label={`Recortar e endireitar ${arquivo.nome}`}>
              <Icone nome="recortar" />
            </button>
          )}
          {aoSubir && (
            <button type="button" onClick={aoSubir} aria-label={`Passar ${arquivo.nome} para antes`}>
              <Icone nome="subir" />
            </button>
          )}
          <button type="button" onClick={aoTirar} aria-label={`Tirar ${arquivo.nome}`}>
            <Icone nome="fechar" />
          </button>
        </span>
        {conteudo}
      </div>
    );
  return (
    <button type="button" className="doc-arquivo" onClick={aoAbrir} aria-label={`Abrir ${arquivo.nome}`}>
      {conteudo}
    </button>
  );
}

// ---------- Ver ----------

const FORMATOS: { valor: FormatoCopia; rotulo: string }[] = [
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'meia', rotulo: 'Meia folha' },
  { valor: 'folha', rotulo: 'Folha A4' },
];

function FolhaVer({ doc, aoFechar, aoEditar, aoMostrar }: { doc: Documento; aoFechar: () => void; aoEditar: () => void; aoMostrar: (pagina: number) => void }) {
  const { repo, bebe, nomeDe, gravar, mostrarAviso } = useDados();
  const { preparando, msg, setMsg, rodar, botaoPronto } = usePreparo();
  const [copia, setCopia] = useState(false);
  const [formato, setFormato] = useState<FormatoCopia>(() => formatoPadrao(doc));
  const modelo = doc.modelo_id ? MODELO_POR_ID.get(doc.modelo_id) : undefined;
  const fotos = doc.arquivos.filter(ehFoto);
  const fixado = naCarteira(doc);

  const enviarPdf = () =>
    rodar(doc.titulo, async (passo) => {
      const so = doc.arquivos.length === 1 ? doc.arquivos[0] : null;
      if (so?.tipo === 'application/pdf') return new File([await obterArquivo(repo, so.caminho)], nomeArquivo(doc.titulo, bebe?.nome), { type: 'application/pdf' });
      passo('Montando o PDF…');
      const [mod, docs] = await Promise.all([import('../lib/pdf-documentos'), paraPdf(repo, [doc])]);
      const { bytes, avisos } = await mod.montarPdfDocumentos(docs, null);
      if (avisos.length) setMsg(avisos.join(' '));
      return arquivoPdf(bytes, nomeArquivo(doc.titulo, bebe?.nome));
    });

  const enviarCopia = () =>
    rodar(`Cópia – ${doc.titulo}`, async (passo) => {
      passo('Montando a cópia…');
      const [mod, [conv]] = await Promise.all([import('../lib/pdf-documentos'), paraPdf(repo, [{ ...doc, arquivos: fotos }])]);
      const bytes = await mod.montarCopiaTamanhoReal(conv.arquivos, formato, [doc.titulo, bebe?.nome].filter(Boolean).join(' – '));
      return arquivoPdf(bytes, nomeArquivo(`Cópia ${doc.titulo}`, bebe?.nome));
    });

  const enviarOriginais = () => rodar(doc.titulo, async () => Promise.all(doc.arquivos.map(async (a) => new File([await obterArquivo(repo, a.caminho)], a.nome, { type: a.tipo }))));

  function excluir() {
    if (!window.confirm(`Excluir "${doc.titulo}" e ${doc.arquivos.length ? 'os arquivos dele' : 'os dados'}? Não dá para desfazer.`)) return;
    gravar({ tipo: 'excluir', dado: { alvo: 'documentos', id: doc.id } });
    if (doc.arquivos.length) void repo.excluirArquivos(doc.arquivos.map((a) => a.caminho)).catch(() => undefined);
    mostrarAviso({ texto: 'Documento excluído' });
    aoFechar();
  }

  function alternarCarteira() {
    gravar({ tipo: 'colecao', colecao: 'documentos', dado: { ...doc, fixado: !fixado } });
    mostrarAviso({ texto: fixado ? 'Saiu da carteira' : 'Está na carteira, no topo da aba' });
  }

  return (
    <Folha titulo={doc.titulo} aoFechar={aoFechar}>
      <div className="pilha">
        <div className="linha" style={{ gap: 6 }}>
          <span className="etiqueta">{NOME_CATEGORIA[doc.categoria]}</span>
          {fixado && <span className="etiqueta bom">Na carteira</span>}
          <EtiquetaValidade validade={doc.validade} />
        </div>
        {modelo && !doc.arquivos.length && <p className="texto-2">{modelo.dica}</p>}
        {(doc.numero || doc.data || doc.validade) && (
          <div className="grade">
            {doc.numero && (
              <div className="bloco" style={{ gridColumn: '1 / -1' }}>
                <div className="rotulo">{modelo?.numero ?? 'Número'}</div>
                <div className="linha" style={{ flexWrap: 'nowrap' }}>
                  <div className="valor cresce">{doc.numero}</div>
                  <CopiarNumero numero={doc.numero} />
                </div>
              </div>
            )}
            {doc.data && (
              <div className="bloco">
                <div className="rotulo">Data</div>
                <div className="valor">{dataBr(doc.data)}</div>
              </div>
            )}
            {doc.validade && (
              <div className="bloco">
                <div className="rotulo">Validade</div>
                <div className="valor">{dataBr(doc.validade)}</div>
              </div>
            )}
          </div>
        )}
        {doc.observacao && <p style={{ whiteSpace: 'pre-wrap' }}>{doc.observacao}</p>}
        {doc.arquivos.length > 0 ? (
          <>
            <div className="doc-arquivos">
              {doc.arquivos.map((a, i) => (
                <ArquivoTile key={a.caminho} arquivo={a} ordem={i + 1} aoAbrir={() => aoMostrar(i)} />
              ))}
            </div>
            <button className="botao primario" onClick={() => aoMostrar(0)}>
              <Icone nome="olho" /> Mostrar em tela cheia
            </button>
            <div className="grade">
              <button className="botao" disabled={!!preparando} onClick={() => void enviarPdf()}>
                <Icone nome="compartilhar" /> Enviar / imprimir
              </button>
              <button className="botao" disabled={!!preparando || !fotos.length} onClick={() => setCopia(!copia)} aria-expanded={copia}>
                <Icone nome="imprimir" /> Cópia
              </button>
            </div>
            {copia && (
              <div className="cartao-interno pilha-p">
                <strong>Cópia em tamanho real</strong>
                <p className="texto-2">Frente e verso na mesma folha, no tamanho do documento, como uma xerox. Na impressão, deixe em 100% (sem ajustar à página).</p>
                <Escolhas opcoes={FORMATOS} valor={formato} aoMudar={setFormato} rotulo="Tamanho" />
                <p className="mudo">{formato === 'cartao' ? 'Cartão: 8,6 × 5,4 cm (cartão do SUS, carteirinha, identidade, CNH).' : formato === 'meia' ? 'Meia folha: até 2 páginas por folha A4.' : 'Folha A4: uma página por folha.'}</p>
                <button className="botao primario" disabled={!!preparando} onClick={() => void enviarCopia()}>
                  <Icone nome="imprimir" /> Gerar cópia
                </button>
              </div>
            )}
            {preparando && <p className="mudo">{preparando}</p>}
            {botaoPronto}
            {(doc.arquivos.length > 1 || fotos.length > 0) && (
              <button className="botao pequeno texto" disabled={!!preparando} onClick={() => void enviarOriginais()}>
                Enviar os arquivos originais (fotos)
              </button>
            )}
          </>
        ) : (
          <div className="alerta info">Ainda sem arquivo. Toque em Editar para tirar uma foto ou anexar o PDF.</div>
        )}
        {msg && <div className="alerta erro">{msg}</div>}
        <div className="grade">
          <button className="botao" onClick={aoEditar}>
            Editar
          </button>
          <button className="botao" onClick={alternarCarteira}>
            <Icone nome="carteira" /> {fixado ? 'Tirar da carteira' : 'Pôr na carteira'}
          </button>
        </div>
        {doc.criado_por && <p className="mudo">Guardado por {nomeDe(doc.criado_por)}</p>}
        <button className="botao perigo" onClick={excluir}>
          <Icone nome="lixeira" /> Excluir
        </button>
      </div>
    </Folha>
  );
}

// ---------- Exportar vários / kits ----------

function FolhaExportar({ docs, kit, aoFechar, aoGuardar }: { docs: Documento[]; kit?: Kit; aoFechar: () => void; aoGuardar: (m: ModeloDocumento) => void }) {
  const dados = useDados();
  const { repo, bebe } = dados;
  const montado = useMemo(() => (kit ? montarKit(kit, docs) : null), [kit, docs]);
  const lista = montado ? montado.documentos : docs;
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(lista.filter((d) => guardado(d)).map((d) => d.id)));
  const [vacinacao, setVacinacao] = useState(montado?.incluiVacinacao ?? false);
  const [capa, setCapa] = useState(true);
  const { preparando, msg, setMsg, rodar, botaoPronto } = usePreparo();
  const escolhidos = lista.filter((d) => marcados.has(d.id));
  const nomeBebe = bebe?.nome || 'bebê';
  const titulo = kit ? `${kit.titulo} – ${nomeBebe}` : `Documentos – ${nomeBebe}`;
  const total = escolhidos.length + (vacinacao ? 1 : 0);

  const gerar = () =>
    rodar(titulo, async (passo) => {
      const [mod, convertidos] = await Promise.all([import('../lib/pdf-documentos'), paraPdf(repo, escolhidos, (feito, t) => passo(`Lendo ${feito} de ${t} arquivos…`))]);
      if (vacinacao) {
        passo('Montando o comprovante de vacinação…');
        const b = await gerarComprovanteVacinacao(dados);
        const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
        convertidos.push({ titulo: 'Comprovante de vacinação (gerado pelo app)', categoria: 'Saúde', numero: null, data: dataBr(dados.hoje), validade: null, observacao: null, arquivos: [{ nome: 'vacinacao.pdf', tipo: 'application/pdf', bytes: buf }] });
      }
      passo('Montando o PDF…');
      const nasc = bebe?.nascimento ? `Nasceu em ${dataBr(chaveDia(bebe.nascimento))}` : '';
      const { bytes, avisos } = await mod.montarPdfDocumentos(
        convertidos,
        capa ? { titulo, subtitulo: [nasc, qtd(convertidos.length, 'documento', 'documentos')].filter(Boolean).join(' · '), geradoEm: new Date().toLocaleString('pt-BR') } : null,
      );
      if (avisos.length) setMsg(avisos.join(' '));
      return arquivoPdf(bytes, nomeArquivo(kit ? kit.titulo : 'Documentos', bebe?.nome));
    });

  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Folha titulo={kit ? kit.titulo : 'Exportar em PDF'} aoFechar={aoFechar}>
      <div className="pilha">
        <p className="texto-2">{kit ? `Os documentos desta situação num PDF só: para enviar, salvar em Arquivos ou imprimir.` : 'Escolha os documentos: o app junta tudo num PDF só, para enviar pelo WhatsApp ou e-mail, salvar em Arquivos ou imprimir.'}</p>
        {!kit && (
          <div className="linha">
            <button type="button" className="botao pequeno" onClick={() => setMarcados(new Set(lista.map((d) => d.id)))}>
              Marcar todos
            </button>
            <button type="button" className="botao pequeno" onClick={() => setMarcados(new Set())}>
              Desmarcar
            </button>
          </div>
        )}
        <div>
          {lista.map((d) => (
            <label key={d.id} className="marcar">
              <input type="checkbox" checked={marcados.has(d.id)} onChange={() => alternar(d.id)} />
              <span className="cresce">
                <span className="doc-titulo">{d.titulo}</span>
                <span className="texto-2">
                  {NOME_CATEGORIA[d.categoria]} · {d.arquivos.length ? qtd(d.arquivos.length, 'arquivo', 'arquivos') : 'só os dados'}
                </span>
                <EtiquetaValidade validade={d.validade} />
              </span>
            </label>
          ))}
          <label className="marcar">
            <input type="checkbox" checked={vacinacao} onChange={() => setVacinacao(!vacinacao)} />
            <span className="cresce">
              <span className="doc-titulo">Comprovante de vacinação</span>
              <span className="texto-2">Gerado pelo app com as doses marcadas em Saúde → Vacinas</span>
            </span>
          </label>
        </div>
        {(() => {
          // Kit/PDF com documento vencido: avisa antes de mandar (ex.: carteirinha do plano vencida)
          const vencidos = escolhidos.filter((d) => situacaoValidade(d.validade, dados.hoje) === 'vencido');
          return vencidos.length ? (
            <div className="alerta erro" role="status">
              <Icone nome="alerta" />
              <span>
                {vencidos.length === 1 ? `${vencidos[0].titulo}: venceu em ${dataBr(vencidos[0].validade!)}.` : `Vencidos: ${vencidos.map((d) => `${d.titulo} (${dataBr(d.validade!)})`).join(', ')}.`} Confira antes de enviar.
              </span>
            </div>
          ) : null;
        })()}
        {montado && montado.faltam.length > 0 && (
          <div className="cartao-interno pilha-p">
            <strong>Ainda não guardados</strong>
            {montado.faltam.map((m) => (
              <div key={m.id} className="linha" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <span className="texto-2">{m.titulo}</span>
                <button type="button" className="botao pequeno" style={{ flex: 'none', whiteSpace: 'nowrap' }} onClick={() => aoGuardar(m)}>
                  Guardar
                </button>
              </div>
            ))}
          </div>
        )}
        <Campo rotulo="Capa com índice e números" grupo>
          <Escolhas
            opcoes={[
              { valor: true, rotulo: 'Com capa' },
              { valor: false, rotulo: 'Sem capa' },
            ]}
            valor={capa}
            aoMudar={setCapa}
          />
        </Campo>
        <button className="botao primario" disabled={!total || !!preparando} onClick={() => void gerar()}>
          <Icone nome="compartilhar" /> {preparando ?? `Gerar PDF (${qtd(total, 'documento', 'documentos')})`}
        </button>
        {botaoPronto}
        {msg && <div className="alerta erro">{msg}</div>}
      </div>
    </Folha>
  );
}

// ---------- Tela ----------

type Aberta =
  | { modo: 'ver'; id: string }
  | { modo: 'editar'; doc: Documento; novo: boolean }
  | { modo: 'exportar'; kit?: Kit }
  | { modo: 'mostrar'; id: string; pagina: number; voltar: boolean }
  | null;

export function SecaoDocumentos() {
  const dados = useDados();
  const { documentos, bebe, membro, usuario, hoje } = dados;
  const [aberta, setAberta] = useState<Aberta>(null);
  const [busca, setBusca] = useState('');
  const [verOpcionais, setVerOpcionais] = useState(false);
  const [zipando, setZipando] = useState<string | null>(null);
  const [zipPronto, setZipPronto] = useState<File | null>(null);
  const vacina = usePreparo();

  const doBebe = useMemo(() => ordenar(documentos.filter((d) => !bebe || d.bebe_id === bebe.id)), [documentos, bebe]);
  const porModelo = useMemo(() => new Map(doBebe.filter((d) => d.modelo_id).map((d) => [d.modelo_id!, d])), [doBebe]);
  // Na carteira, primeiro os que mais se mostram (SUS, plano, certidão...)
  const carteira = useMemo(() => {
    const prioridade = ['cns', 'carteirinha', 'certidao', 'cin', 'passaporte', 'cpf'];
    const peso = (d: Documento) => (d.modelo_id && prioridade.includes(d.modelo_id) ? prioridade.indexOf(d.modelo_id) : 99);
    return doBebe.filter(naCarteira).sort((a, b) => peso(a) - peso(b));
  }, [doBebe]);
  const livres = doBebe.filter((d) => !d.modelo_id || !MODELO_POR_ID.has(d.modelo_id));
  const principais = MODELOS.filter((m) => m.principal);
  const opcionais = MODELOS.filter((m) => !m.principal && m.categoria !== 'familia');
  const daFamilia = MODELOS.filter((m) => m.categoria === 'familia');
  const feitos = principais.filter((m) => guardado(porModelo.get(m.id))).length;
  const numeros = doBebe.filter((d) => d.numero?.trim());
  const alertas = doBebe.filter((d) => {
    const s = situacaoValidade(d.validade, hoje);
    return s === 'vencido' || s === 'vence-logo';
  });
  const resultados = busca.trim() ? doBebe.filter((d) => combinaBusca(d, busca)) : null;

  function novo(modelo?: ModeloDocumento, categoria: CategoriaDocumento = 'saude') {
    if (!bebe || !membro) return;
    const doc: Documento = {
      id: modelo ? idFixo(`${bebe.id}:documento:${modelo.id}`) : crypto.randomUUID(),
      familia_id: membro.familia_id,
      bebe_id: bebe.id,
      criado_por: usuario?.id ?? null,
      categoria: modelo?.categoria ?? categoria,
      modelo_id: modelo?.id ?? null,
      titulo: modelo?.titulo ?? '',
      numero: null,
      data: null,
      validade: null,
      observacao: null,
      arquivos: [],
    };
    setAberta({ modo: 'editar', doc, novo: true });
  }

  const abrirModelo = (m: ModeloDocumento) => {
    const d = porModelo.get(m.id);
    if (d) setAberta({ modo: 'ver', id: d.id });
    else novo(m);
  };

  const linhaModelo = (m: ModeloDocumento) => {
    const d = porModelo.get(m.id);
    const ok = guardado(d);
    return (
      <button key={m.id} type="button" className="doc-linha" onClick={() => abrirModelo(m)}>
        <Miniatura doc={d} modelo={m} />
        <span className="cresce">
          <span className="doc-titulo">{m.titulo}</span>
          <span className="texto-2">{ok && d ? (d.arquivos.length ? qtd(d.arquivos.length, 'arquivo', 'arquivos') : 'Só o número') : 'Toque para guardar'}</span> {d && <EtiquetaValidade validade={d.validade} />}
        </span>
        {ok ? <span className="etiqueta bom">Guardado</span> : <span className="etiqueta">Falta</span>}
      </button>
    );
  };

  const docAberto = aberta?.modo === 'ver' || aberta?.modo === 'mostrar' ? doBebe.find((d) => d.id === aberta.id) : undefined;
  const mostrar = (d: Documento, pagina = 0, voltar = false) => setAberta({ modo: 'mostrar', id: d.id, pagina, voltar });

  /** Do visualizador: manda os arquivos como estão (já ficam no celular, então sai na hora) */
  const enviarDoVisualizador = async (doc: Documento) => {
    try {
      const arquivos = await Promise.all(doc.arquivos.map(async (a) => new File([await obterArquivo(dados.repo, a.caminho)], a.nome, { type: a.tipo })));
      await compartilhar(arquivos, doc.titulo);
    } catch (e) {
      dados.setErro(traduzirErro(e));
    }
  };

  /** Todos os arquivos num .zip, cada um com o nome do documento no app, em pastas por categoria */
  const comArquivo = doBebe.filter((d) => d.arquivos.length > 0);
  const baixarZip = async () => {
    setZipPronto(null);
    const quando = hoje.split('-').reverse().join('-');
    const nome = limpar(`Documentos${bebe?.nome ? ` do ${bebe.nome}` : ''} ${quando}`);
    const lista = planejarDocumentos(doBebe, nome);
    // Um arquivo por vez: entra no .zip e sai da memória
    const zip = new MontadorZip();
    const baixados: typeof lista = [];
    const faltaram: string[] = [];
    try {
      for (let i = 0; i < lista.length; i++) {
        setZipando(`Baixando ${i + 1} de ${lista.length}…`);
        try {
          const blob = await obterArquivo(dados.repo, lista[i].caminho);
          zip.adicionar(lista[i].destino, new Uint8Array(await blob.arrayBuffer()));
          baixados.push(lista[i]);
        } catch {
          faltaram.push(lista[i].destino);
        }
      }
      if (!baixados.length) throw new Error('Não deu para baixar os arquivos. Confira a internet e tente de novo.');
      setZipando('Montando o .zip…');
      await new Promise((ok) => setTimeout(ok, 30));
      zip.adicionarTexto(`${nome}/Lista dos documentos.txt`, listaDocumentos(doBebe, baixados, `Documentos${bebe?.nome ? ` do ${bebe.nome}` : ''}`));
      const arquivo = new File([zip.terminar()], `${nome}.zip`, { type: 'application/zip' });
      setZipPronto(arquivo);
      setZipando(null);
      const r = await compartilhar([arquivo], arquivo.name);
      if (faltaram.length) dados.setErro(`${qtd(faltaram.length, 'arquivo ficou', 'arquivos ficaram')} de fora (sem internet?): ${faltaram.map((f) => f.split('/').pop()).join(', ')}`);
      else if (r === 'bloqueado') dados.mostrarAviso({ texto: 'O .zip está pronto! Toque em “Compartilhar o .zip”' });
    } catch (e) {
      dados.setErro(traduzirErro(e));
    } finally {
      setZipando(null);
    }
  };

  if (!bebe) return <div className="alerta">Cadastre o bebê em Ajustes para guardar os documentos.</div>;

  return (
    <div className="pilha">
      <section aria-label="Carteira" className="pilha-p">
        {carteira.length > 0 && <p className="mudo td-dica-carteira">Toque num cartão para mostrar</p>}
        {carteira.length ? (
          // Empilhados como na Carteira do iPhone: o mais usado fica na frente, inteiro; os outros mostram só a faixa de cima
          <ul className={`carteira-pilha ${carteira.length > 4 ? 'apertada' : ''}`}>
            {[...carteira].reverse().map((d) => (
              <li key={d.id}>
                <CartaoCarteira doc={d} aoAbrir={() => mostrar(d)} />
              </li>
            ))}
          </ul>
        ) : (
          <CarteiraVazia />
        )}
        <StatusOffline />
      </section>

      <label className="campo busca">
        <Icone nome="busca" />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar (nome, número, anotação)" aria-label="Buscar documentos" />
      </label>
      <div className="grade">
        <button className="botao primario" onClick={() => novo()}>
          <Icone nome="mais" /> Adicionar
        </button>
        <button className="botao" disabled={!doBebe.length} onClick={() => setAberta({ modo: 'exportar' })}>
          <Icone nome="compartilhar" /> Exportar PDF
        </button>
      </div>
      <div className="pilha-p">
        <button
          className="botao td-contorno"
          disabled={zipando !== null}
          aria-disabled={!comArquivo.length || undefined}
          onClick={() => (comArquivo.length ? void baixarZip() : dados.mostrarAviso({ texto: 'Ainda não há documentos com foto ou PDF' }))}
          aria-label={zipando ?? 'Baixar todos os arquivos dos documentos em .zip'}
        >
          <Icone nome="baixar" /> {zipando ?? (comArquivo.length ? `Baixar tudo em .zip (${comArquivo.reduce((n, d) => n + d.arquivos.length, 0)})` : 'Baixar tudo em .zip')}
        </button>
        <p className="mudo td-ajuda">Junta as fotos e PDFs de todos os documentos num arquivo só.</p>
        {zipPronto && zipando === null && (
          <button className="botao" onClick={() => void compartilhar([zipPronto], zipPronto.name)}>
            <Icone nome="compartilhar" /> Compartilhar o .zip
          </button>
        )}
      </div>

      {resultados ? (
        <section className="cartao">
          <h2>{qtd(resultados.length, 'resultado', 'resultados')}</h2>
          <div className="doc-lista">
            {resultados.map((d) => (
              <LinhaDocumento key={d.id} doc={d} aoAbrir={() => setAberta({ modo: 'ver', id: d.id })} />
            ))}
          </div>
          {!resultados.length && <p className="texto-2">Nada com “{busca.trim()}”.</p>}
        </section>
      ) : (
        <>
          {alertas.length > 0 && (
            <div className="alerta">
              <Icone nome="alerta" />
              <span>{alertas.map((d) => (d.validade === hoje ? `${d.titulo} vence hoje` : `${d.titulo} ${situacaoValidade(d.validade, hoje) === 'vencido' ? 'venceu' : 'vence'} em ${dataBr(d.validade!)}`)).join('; ')}.</span>
            </div>
          )}

          <section className="cartao pilha-p">
            <h2>Kits prontos</h2>
            <p className="mudo">Um toque junta os documentos de cada situação num PDF só.</p>
            <div className="menu-lista">
              {KITS.map((k) => {
                const m = montarKit(k, doBebe);
                return (
                  <button key={k.id} type="button" onClick={() => setAberta({ modo: 'exportar', kit: k })}>
                    <Icone nome={k.icone} />
                    <span className="cresce">
                      <span style={{ display: 'block', fontWeight: 600 }}>{k.titulo}</span>
                      <span className="texto-2">{m.faltam.length ? `${qtd(m.documentos.length + (m.incluiVacinacao ? 1 : 0), 'pronto', 'prontos')} · falta ${m.faltam.length}` : k.detalhe}</span>
                    </span>
                    <span className="seta">
                      <Icone nome="seta" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="cartao pilha-p">
            <h2>Principais documentos</h2>
            <span className="texto-2">
              {feitos} de {principais.length} guardados
            </span>
            <div className="progresso" aria-hidden="true">
              <span style={{ width: `${(feitos / principais.length) * 100}%` }} />
            </div>
            <div className="doc-lista">{principais.map(linhaModelo)}</div>
            <button type="button" className="botao pequeno texto" onClick={() => setVerOpcionais(!verOpcionais)} aria-expanded={verOpcionais}>
              {verOpcionais ? 'Esconder os opcionais' : `Ver também: ${opcionais.map((m) => m.titulo.split(' (')[0].replace('Resultado do ', '')).join(', ')}`}
            </button>
            {verOpcionais && <div className="doc-lista">{opcionais.map(linhaModelo)}</div>}
          </section>

          <section className="cartao pilha-p">
            <h2>Documentos da família</h2>
            <p className="mudo">Quase sempre pedidos junto com os do bebê (creche, plano, benefícios).</p>
            <div className="doc-lista">{daFamilia.map(linhaModelo)}</div>
          </section>

          {numeros.length > 0 && (
            <section className="cartao">
              <h2>Números à mão</h2>
              <p className="mudo" style={{ marginBottom: 4 }}>
                Para preencher cadastros na farmácia, no plano ou na escola.
              </p>
              {numeros.map((d) => (
                <div key={d.id} className="doc-numero">
                  <span className="cresce">
                    <span className="texto-2" style={{ display: 'block' }}>
                      {d.modelo_id ? (MODELO_POR_ID.get(d.modelo_id)?.numero ? `${MODELO_POR_ID.get(d.modelo_id)!.numero} · ${d.titulo.split(' (')[0]}` : d.titulo) : d.titulo}
                    </span>
                    <span className="valor">{d.numero}</span>
                  </span>
                  <CopiarNumero numero={d.numero!} />
                </div>
              ))}
            </section>
          )}

          {CATEGORIAS.map((c) => {
            const lista = livres.filter((d) => d.categoria === c.id);
            if (!lista.length) return null;
            return (
              <section key={c.id} className="cartao">
                <div className="cartao-cab">
                  <h2>{c.nome}</h2>
                  <button type="button" className="icone-botao" aria-label={`Adicionar em ${c.nome}`} onClick={() => novo(undefined, c.id)}>
                    <Icone nome="mais" />
                  </button>
                </div>
                <div className="doc-lista">
                  {lista.map((d) => (
                    <LinhaDocumento key={d.id} doc={d} aoAbrir={() => setAberta({ modo: 'ver', id: d.id })} />
                  ))}
                </div>
              </section>
            );
          })}

          {!livres.length && (
            <section className="cartao pilha-p">
              <h2>Receitas, exames e outros</h2>
              <p className="texto-2">Tudo o que não está nas listas acima: receitas, pedidos e resultados de exames, relatórios, guias do plano, matrícula da creche…</p>
              <div className="chips">
                {CATEGORIAS.filter((c) => c.id !== 'identificacao').map((c) => (
                  <button key={c.id} type="button" className="chip" onClick={() => novo(undefined, c.id)}>
                    + {c.nome}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="cartao pilha-p">
            <h2>Gerados pelo app</h2>
            <div className="menu-lista">
              <button
                type="button"
                disabled={!!vacina.preparando}
                onClick={() =>
                  void vacina.rodar(`Comprovante de vacinação – ${bebe.nome || 'bebê'}`, async () => arquivoPdf(await gerarComprovanteVacinacao(dados), nomeArquivo('Comprovante de vacinação', bebe.nome)))
                }
              >
                <Icone nome="vacina" />
                <span className="cresce">
                  <span style={{ display: 'block', fontWeight: 600 }}>Comprovante de vacinação (PDF)</span>
                  <span className="texto-2">{vacina.preparando ?? 'Doses aplicadas, lotes e próximas doses'}</span>
                </span>
                <span className="seta">
                  <Icone nome="compartilhar" />
                </span>
              </button>
              <Link to="/mais/resumo">
                <Icone nome="grafico" />
                <span className="cresce">
                  <span style={{ display: 'block', fontWeight: 600 }}>Relatório para o pediatra</span>
                  <span className="texto-2">PDF com crescimento, vacinas e rotina</span>
                </span>
                <span className="seta">
                  <Icone nome="seta" />
                </span>
              </Link>
            </div>
            {vacina.botaoPronto}
            {vacina.msg && <div className="alerta erro">{vacina.msg}</div>}
          </section>
          <p className="mudo" style={{ textAlign: 'center' }}>
            Os arquivos ficam guardados com segurança na nuvem de vocês (só a sua família vê) e com uma cópia neste celular.
          </p>
        </>
      )}

      {aberta?.modo === 'ver' && docAberto && (
        <FolhaVer doc={docAberto} aoFechar={() => setAberta(null)} aoEditar={() => setAberta({ modo: 'editar', doc: docAberto, novo: false })} aoMostrar={(p) => mostrar(docAberto, p, true)} />
      )}
      {aberta?.modo === 'mostrar' && docAberto && (
        <Visualizador
          doc={docAberto}
          inicio={aberta.pagina}
          aoFechar={() => setAberta(aberta.voltar ? { modo: 'ver', id: docAberto.id } : null)}
          aoCompartilhar={docAberto.arquivos.length ? () => void enviarDoVisualizador(docAberto) : undefined}
        />
      )}
      {aberta?.modo === 'editar' && <FolhaEditar inicial={aberta.doc} novo={aberta.novo} aoFechar={() => setAberta(null)} aoSalvar={(d) => setAberta({ modo: 'ver', id: d.id })} />}
      {aberta?.modo === 'exportar' && <FolhaExportar docs={doBebe} kit={aberta.kit} aoFechar={() => setAberta(null)} aoGuardar={(m) => abrirModelo(m)} />}
    </div>
  );
}
