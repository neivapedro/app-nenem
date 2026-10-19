import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDados } from '../dados/contexto';
import { chaveDia, dataBr } from '../lib/datas';
import {
  CATEGORIAS,
  combinaBusca,
  guardado,
  LIMITE_ARQUIVO,
  MODELO_POR_ID,
  MODELOS,
  NOME_CATEGORIA,
  nomeArquivo,
  situacaoValidade,
  SUGESTOES,
  tamanhoTexto,
  type ModeloDocumento,
} from '../lib/documentos';
import { traduzirErro } from '../lib/erros';
import { idFixo } from '../lib/ids';
import { reduzirFoto } from '../lib/imagem';
import type { DocParaPdf } from '../lib/pdf-documentos';
import type { ArquivoDocumento, CategoriaDocumento, Documento } from '../lib/tipos';
import { Campo, Escolhas, Folha, Icone } from './ui';

// ---------- Arquivos: endereço, envio e compartilhamento ----------

/** Endereço temporário do arquivo (pedido ao servidor; precisa de internet) */
function useUrlArquivo(caminho: string | null): string | null {
  const { repo } = useDados();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    repo
      .urlArquivo(caminho)
      .then((u) => vivo && setUrl(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [repo, caminho]);
  return caminho ? url : null;
}

/**
 * Abre a folha de compartilhar do iPhone (WhatsApp, e-mail, AirDrop, Salvar em
 * Arquivos, Imprimir...). 'bloqueado' = o iPhone pediu um toque novo (o PDF
 * demorou para ficar pronto): o app mostra um botão para compartilhar.
 */
async function compartilhar(arquivos: File[], titulo: string): Promise<'ok' | 'bloqueado'> {
  if (navigator.canShare?.({ files: arquivos })) {
    try {
      await navigator.share({ files: arquivos, title: titulo });
      return 'ok';
    } catch (e) {
      const nome = (e as Error).name;
      if (nome === 'AbortError') return 'ok';
      if (nome === 'NotAllowedError') return 'bloqueado';
    }
  }
  // Sem a folha de compartilhar (computador): baixa
  for (const arquivo of arquivos) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return 'ok';
}

const ehPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const ehImagem = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name);

/** Nome do arquivo: câmera do iPhone manda "image.jpg"; aí vira "Foto 2.jpg" */
function nomeGuardado(f: File, ordem: number): string {
  if (ehPdf(f)) return f.name || `Documento ${ordem}.pdf`;
  const base = f.name.replace(/\.[^.]+$/, '');
  return /^(image|img_\d+|photo|imagem)$/i.test(base) || !base ? `Foto ${ordem}.jpg` : `${base}.jpg`;
}

/** Prepara (foto reduzida para JPEG nítido; PDF como está) e envia. */
async function prepararEEnviar(repo: ReturnType<typeof useDados>['repo'], f: File, ordem: number): Promise<ArquivoDocumento> {
  if (ehPdf(f)) {
    if (f.size > LIMITE_ARQUIVO) throw new Error(`"${f.name}" tem ${tamanhoTexto(f.size)}; o limite é 20 MB.`);
    const caminho = await repo.enviarArquivo(f, 'pdf');
    return { caminho, nome: nomeGuardado(f, ordem), tipo: 'application/pdf', tamanho: f.size };
  }
  if (ehImagem(f)) {
    // 2400 px no lado maior: dá para ler letras pequenas e ocupa pouco
    const blob = await reduzirFoto(f, 2400, 0.86);
    const caminho = await repo.enviarArquivo(blob, 'jpg');
    return { caminho, nome: nomeGuardado(f, ordem), tipo: 'image/jpeg', tamanho: blob.size };
  }
  throw new Error(`"${f.name}" não é foto nem PDF. Para Word ou outros, salve como PDF antes.`);
}

/** Documentos no formato do gerador de PDF (baixa os arquivos) */
async function paraPdf(repo: ReturnType<typeof useDados>['repo'], docs: Documento[], aoProgredir?: (feito: number, total: number) => void): Promise<DocParaPdf[]> {
  const total = docs.reduce((s, d) => s + d.arquivos.length, 0);
  let feito = 0;
  const saida: DocParaPdf[] = [];
  for (const d of docs) {
    const arquivos = [];
    for (const a of d.arquivos) {
      const blob = await repo.baixarArquivo(a.caminho);
      arquivos.push({ nome: a.nome, tipo: a.tipo, bytes: await blob.arrayBuffer() });
      aoProgredir?.(++feito, total);
    }
    saida.push({
      titulo: d.titulo,
      categoria: NOME_CATEGORIA[d.categoria],
      numero: d.numero,
      data: d.data ? dataBr(d.data) : null,
      validade: d.validade ? dataBr(d.validade) : null,
      observacao: d.observacao,
      arquivos,
    });
  }
  return saida;
}

function ordenar(docs: Documento[]): Documento[] {
  const ordemModelo = new Map(MODELOS.map((m, i) => [m.id, i]));
  const ordemCat = new Map(CATEGORIAS.map((c, i) => [c.id, i]));
  return [...docs].sort(
    (a, b) =>
      (ordemCat.get(a.categoria) ?? 9) - (ordemCat.get(b.categoria) ?? 9) ||
      (ordemModelo.get(a.modelo_id ?? '') ?? 99) - (ordemModelo.get(b.modelo_id ?? '') ?? 99) ||
      (b.data ?? '').localeCompare(a.data ?? '') ||
      a.titulo.localeCompare(b.titulo, 'pt-BR'),
  );
}

// ---------- Peças da tela ----------

function Miniatura({ doc, modelo }: { doc?: Documento; modelo?: ModeloDocumento }) {
  const primeiraFoto = doc?.arquivos.find((a) => a.tipo.startsWith('image/'))?.caminho ?? null;
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
  if (s === 'vence-logo') return <span className="etiqueta aviso">Vence em {dataBr(validade)}</span>;
  return null;
}

function LinhaDocumento({ doc, aoAbrir }: { doc: Documento; aoAbrir: () => void }) {
  const partes = [
    doc.arquivos.length ? `${doc.arquivos.length} ${doc.arquivos.length === 1 ? 'arquivo' : 'arquivos'}` : doc.numero ? 'Só o número' : 'Sem arquivo',
    doc.data && dataBr(doc.data),
  ].filter(Boolean);
  return (
    <button type="button" className="doc-linha" onClick={aoAbrir}>
      <Miniatura doc={doc} />
      <span className="cresce">
        <span className="doc-titulo">{doc.titulo}</span>
        <span className="texto-2">{partes.join(' · ')}</span>{' '}
        <EtiquetaValidade validade={doc.validade} />
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

// ---------- Editar / novo ----------

function FolhaEditar({ inicial, novo, aoFechar, aoSalvar }: { inicial: Documento; novo: boolean; aoFechar: () => void; aoSalvar: (d: Documento) => void }) {
  const { repo, gravar, mostrarAviso, setErro } = useDados();
  const [d, setD] = useState<Documento>(inicial);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Arquivos enviados nesta edição: se cancelar, apaga do servidor
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

  async function adicionar(lista: FileList | null) {
    const arquivos = [...(lista ?? [])];
    if (!arquivos.length) return;
    setMsg(null);
    let ordem = d.arquivos.length;
    const novos: ArquivoDocumento[] = [];
    try {
      for (let i = 0; i < arquivos.length; i++) {
        setEnviando(arquivos.length > 1 ? `Enviando ${i + 1} de ${arquivos.length}…` : 'Enviando…');
        const a = await prepararEEnviar(repo, arquivos[i], ++ordem);
        enviados.current.add(a.caminho);
        novos.push(a);
      }
    } catch (e) {
      setMsg(`${novos.length ? 'Parte dos arquivos foi enviada. ' : ''}Não deu para enviar: ${traduzirErro(e)}`);
    } finally {
      setEnviando(null);
      if (novos.length) setD((atual) => ({ ...atual, arquivos: [...atual.arquivos, ...novos] }));
    }
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const titulo = d.titulo.trim();
    if (!titulo) return setMsg('Dê um nome ao documento.');
    if (enviando) return setMsg('Espere terminar o envio dos arquivos.');
    const final: Documento = { ...d, titulo, numero: d.numero?.trim() || null, observacao: d.observacao?.trim() || null };
    gravar({ tipo: 'colecao', colecao: 'documentos', dado: final });
    // Arquivos tirados na edição saem do servidor
    const ficam = new Set(final.arquivos.map((a) => a.caminho));
    const sairam = inicial.arquivos.filter((a) => !ficam.has(a.caminho)).map((a) => a.caminho);
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
    // Enviado agora e tirado antes de salvar: apaga já
    if (enviados.current.has(a.caminho)) {
      enviados.current.delete(a.caminho);
      void repo.excluirArquivos([a.caminho]).catch(() => undefined);
    }
    setD({ ...d, arquivos: d.arquivos.filter((_, j) => j !== i) });
  }

  return (
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

        <Campo rotulo="Arquivos" grupo dica="Frente e verso? Tire uma foto de cada lado. Dica: no app Arquivos do iPhone (⋯ → Digitalizar documentos) dá para escanear em PDF e anexar aqui.">
          {d.arquivos.length > 0 && (
            <div className="doc-arquivos" style={{ marginBottom: 8 }}>
              {d.arquivos.map((a, i) => (
                <ArquivoTile key={a.caminho} arquivo={a} ordem={i + 1} aoTirar={() => tirar(i)} aoSubir={i > 0 ? () => mover(i) : undefined} />
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
              void adicionar(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={galeria}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void adicionar(e.target.files);
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
  );
}

function ArquivoTile({ arquivo, ordem, aoTirar, aoSubir }: { arquivo: ArquivoDocumento; ordem: number; aoTirar?: () => void; aoSubir?: () => void }) {
  const url = useUrlArquivo(arquivo.caminho);
  const foto = arquivo.tipo.startsWith('image/');
  const conteudo = (
    <>
      {foto && url ? (
        <img src={url} alt={arquivo.nome} loading="lazy" />
      ) : (
        <>
          <Icone nome={foto ? 'imagem' : 'documento'} />
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
  // Toque abre o original (o iPhone mostra com zoom, e dá para compartilhar ou imprimir de lá)
  return url ? (
    <a className="doc-arquivo" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${arquivo.nome}`}>
      {conteudo}
    </a>
  ) : (
    <div className="doc-arquivo">{conteudo}</div>
  );
}

// ---------- Ver ----------

function FolhaVer({ doc, aoFechar, aoEditar }: { doc: Documento; aoFechar: () => void; aoEditar: () => void }) {
  const { repo, bebe, nomeDe, gravar, mostrarAviso } = useDados();
  const [preparando, setPreparando] = useState<string | null>(null);
  const [pronto, setPronto] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const modelo = doc.modelo_id ? MODELO_POR_ID.get(doc.modelo_id) : undefined;

  async function enviarPdf() {
    setMsg(null);
    setPronto(null);
    try {
      let arquivo: File;
      const so = doc.arquivos.length === 1 ? doc.arquivos[0] : null;
      if (so?.tipo === 'application/pdf') {
        // Um PDF só: vai o original
        setPreparando('Baixando…');
        arquivo = new File([await repo.baixarArquivo(so.caminho)], nomeArquivo(doc.titulo, bebe?.nome), { type: 'application/pdf' });
      } else {
        setPreparando('Montando o PDF…');
        const [mod, docs] = await Promise.all([import('../lib/pdf-documentos'), paraPdf(repo, [doc])]);
        const { bytes, avisos } = await mod.montarPdfDocumentos(docs, null);
        if (avisos.length) setMsg(avisos.join(' '));
        arquivo = new File([bytes as BlobPart], nomeArquivo(doc.titulo, bebe?.nome), { type: 'application/pdf' });
      }
      setPreparando(null);
      if ((await compartilhar([arquivo], doc.titulo)) === 'bloqueado') setPronto(arquivo);
    } catch (e) {
      setPreparando(null);
      setMsg(`Não foi possível preparar o PDF: ${traduzirErro(e)}`);
    }
  }

  async function enviarOriginais() {
    setMsg(null);
    try {
      setPreparando('Baixando…');
      const arquivos = await Promise.all(doc.arquivos.map(async (a) => new File([await repo.baixarArquivo(a.caminho)], a.nome, { type: a.tipo })));
      setPreparando(null);
      await compartilhar(arquivos, doc.titulo);
    } catch (e) {
      setPreparando(null);
      setMsg(`Não foi possível baixar os arquivos: ${traduzirErro(e)}`);
    }
  }

  function excluir() {
    if (!window.confirm(`Excluir "${doc.titulo}" e ${doc.arquivos.length ? 'os arquivos dele' : 'os dados'}? Não dá para desfazer.`)) return;
    gravar({ tipo: 'excluir', dado: { alvo: 'documentos', id: doc.id } });
    if (doc.arquivos.length) void repo.excluirArquivos(doc.arquivos.map((a) => a.caminho)).catch(() => undefined);
    mostrarAviso({ texto: 'Documento excluído' });
    aoFechar();
  }

  return (
    <Folha titulo={doc.titulo} aoFechar={aoFechar}>
      <div className="pilha">
        <div className="linha" style={{ gap: 6 }}>
          <span className="etiqueta">{NOME_CATEGORIA[doc.categoria]}</span>
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
                <ArquivoTile key={a.caminho} arquivo={a} ordem={i + 1} />
              ))}
            </div>
            <p className="mudo">Toque num arquivo para abrir em tela cheia (com zoom).</p>
            <button className="botao primario" disabled={!!preparando} onClick={() => void enviarPdf()}>
              <Icone nome="compartilhar" /> {preparando ?? 'Enviar ou salvar em PDF'}
            </button>
            {pronto && (
              <button className="botao" onClick={() => void compartilhar([pronto], doc.titulo)}>
                <Icone nome="compartilhar" /> PDF pronto: toque para enviar
              </button>
            )}
            {doc.arquivos.length > 1 || doc.arquivos[0].tipo !== 'application/pdf' ? (
              <button className="botao pequeno texto" disabled={!!preparando} onClick={() => void enviarOriginais()}>
                Enviar os arquivos originais (fotos)
              </button>
            ) : null}
          </>
        ) : (
          <div className="alerta info">Ainda sem arquivo. Toque em Editar para tirar uma foto ou anexar o PDF.</div>
        )}
        {msg && <div className="alerta erro">{msg}</div>}
        <button className="botao" onClick={aoEditar}>
          Editar
        </button>
        {doc.criado_por && <p className="mudo">Guardado por {nomeDe(doc.criado_por)}</p>}
        <button className="botao perigo" onClick={excluir}>
          <Icone nome="lixeira" /> Excluir
        </button>
      </div>
    </Folha>
  );
}

// ---------- Exportar vários ----------

function FolhaExportar({ docs, aoFechar }: { docs: Documento[]; aoFechar: () => void }) {
  const { repo, bebe } = useDados();
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(docs.filter((d) => guardado(d)).map((d) => d.id)));
  const [capa, setCapa] = useState(true);
  const [preparando, setPreparando] = useState<string | null>(null);
  const [pronto, setPronto] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const escolhidos = docs.filter((d) => marcados.has(d.id));
  const nomeBebe = bebe?.nome || 'bebê';

  async function gerar() {
    setMsg(null);
    setPronto(null);
    try {
      setPreparando('Baixando os arquivos…');
      const [mod, lista] = await Promise.all([
        import('../lib/pdf-documentos'),
        paraPdf(repo, escolhidos, (feito, total) => setPreparando(`Baixando ${feito} de ${total}…`)),
      ]);
      setPreparando('Montando o PDF…');
      const nasc = bebe?.nascimento ? `Nasceu em ${dataBr(chaveDia(bebe.nascimento))}` : '';
      const { bytes, avisos } = await mod.montarPdfDocumentos(
        lista,
        capa ? { titulo: `Documentos – ${nomeBebe}`, subtitulo: [nasc, `${lista.length} ${lista.length === 1 ? 'documento' : 'documentos'}`].filter(Boolean).join(' · '), geradoEm: new Date().toLocaleString('pt-BR') } : null,
      );
      if (avisos.length) setMsg(avisos.join(' '));
      const arquivo = new File([bytes as BlobPart], nomeArquivo('Documentos', bebe?.nome), { type: 'application/pdf' });
      setPreparando(null);
      if ((await compartilhar([arquivo], `Documentos – ${nomeBebe}`)) === 'bloqueado') setPronto(arquivo);
    } catch (e) {
      setPreparando(null);
      setMsg(`Não foi possível gerar o PDF: ${traduzirErro(e)}`);
    }
  }

  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Folha titulo="Exportar em PDF" aoFechar={aoFechar}>
      <div className="pilha">
        <p className="texto-2">Escolha os documentos: o app junta tudo num PDF só, para enviar pelo WhatsApp ou e-mail, salvar em Arquivos ou imprimir.</p>
        <div className="linha">
          <button type="button" className="botao pequeno" onClick={() => setMarcados(new Set(docs.map((d) => d.id)))}>
            Marcar todos
          </button>
          <button type="button" className="botao pequeno" onClick={() => setMarcados(new Set())}>
            Desmarcar
          </button>
        </div>
        <div>
          {docs.map((d) => (
            <label key={d.id} className="marcar">
              <input type="checkbox" checked={marcados.has(d.id)} onChange={() => alternar(d.id)} />
              <span className="cresce">
                <span className="doc-titulo">{d.titulo}</span>
                <span className="texto-2">
                  {NOME_CATEGORIA[d.categoria]} · {d.arquivos.length ? `${d.arquivos.length} ${d.arquivos.length === 1 ? 'arquivo' : 'arquivos'}` : 'só os dados'}
                </span>
              </span>
            </label>
          ))}
        </div>
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
        <button className="botao primario" disabled={!escolhidos.length || !!preparando} onClick={() => void gerar()}>
          <Icone nome="baixar" /> {preparando ?? `Gerar PDF (${escolhidos.length} ${escolhidos.length === 1 ? 'documento' : 'documentos'})`}
        </button>
        {pronto && (
          <button className="botao" onClick={() => void compartilhar([pronto], `Documentos – ${nomeBebe}`)}>
            <Icone nome="compartilhar" /> PDF pronto: toque para enviar
          </button>
        )}
        {msg && <div className="alerta erro">{msg}</div>}
      </div>
    </Folha>
  );
}

// ---------- Tela ----------

type Aberta = { modo: 'ver'; id: string } | { modo: 'editar'; doc: Documento; novo: boolean } | { modo: 'exportar' } | null;

export function SecaoDocumentos() {
  const { documentos, bebe, membro, usuario, hoje } = useDados();
  const [aberta, setAberta] = useState<Aberta>(null);
  const [busca, setBusca] = useState('');
  const [verOpcionais, setVerOpcionais] = useState(false);

  const doBebe = useMemo(() => ordenar(documentos.filter((d) => !bebe || d.bebe_id === bebe.id)), [documentos, bebe]);
  const porModelo = useMemo(() => new Map(doBebe.filter((d) => d.modelo_id).map((d) => [d.modelo_id!, d])), [doBebe]);
  const livres = doBebe.filter((d) => !d.modelo_id || !MODELO_POR_ID.has(d.modelo_id));
  const principais = MODELOS.filter((m) => m.principal);
  const opcionais = MODELOS.filter((m) => !m.principal);
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
          <span className="texto-2">{ok && d ? (d.arquivos.length ? `${d.arquivos.length} ${d.arquivos.length === 1 ? 'arquivo' : 'arquivos'}` : 'Só o número') : 'Toque para guardar'}</span>{' '}
          {d && <EtiquetaValidade validade={d.validade} />}
        </span>
        {ok ? <span className="etiqueta bom">Guardado</span> : <span className="etiqueta">Falta</span>}
      </button>
    );
  };

  const docAberto = aberta?.modo === 'ver' ? doBebe.find((d) => d.id === aberta.id) : undefined;

  if (!bebe) return <div className="alerta">Cadastre o bebê em Ajustes para guardar os documentos.</div>;

  return (
    <div className="pilha">
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

      {resultados ? (
        <section className="cartao">
          <h2>
            {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
          </h2>
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
              <span>
                {alertas.map((d) => `${d.titulo} ${situacaoValidade(d.validade, hoje) === 'vencido' ? 'venceu' : 'vence'} em ${dataBr(d.validade!)}`).join('; ')}.
              </span>
            </div>
          )}

          <section className="cartao pilha-p">
            <h2>Principais documentos</h2>
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <span className="texto-2">
                {feitos} de {principais.length} guardados
              </span>
            </div>
            <div className="progresso" aria-hidden="true">
              <span style={{ width: `${(feitos / principais.length) * 100}%` }} />
            </div>
            <div className="doc-lista">{principais.map(linhaModelo)}</div>
            <button type="button" className="botao pequeno texto" onClick={() => setVerOpcionais(!verOpcionais)} aria-expanded={verOpcionais}>
              {verOpcionais ? 'Esconder os opcionais' : `Ver também: ${opcionais.map((m) => m.titulo.split(' (')[0].replace('Resultado do ', '')).join(', ')}`}
            </button>
            {verOpcionais && <div className="doc-lista">{opcionais.map(linhaModelo)}</div>}
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
                      {d.modelo_id ? (MODELO_POR_ID.get(d.modelo_id)?.numero ?? d.titulo) : d.titulo}
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
              <p className="texto-2">Tudo o que não está na lista acima: receitas, pedidos e resultados de exames, relatórios, guias do plano, matrícula da creche, autorização de viagem…</p>
              <div className="chips">
                {CATEGORIAS.filter((c) => c.id !== 'identificacao').map((c) => (
                  <button key={c.id} type="button" className="chip" onClick={() => novo(undefined, c.id)}>
                    + {c.nome}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="cartao">
            <h2>Também no app</h2>
            <nav className="menu-lista">
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
              <Link to="/saude">
                <Icone nome="vacina" />
                <span className="cresce">
                  <span style={{ display: 'block', fontWeight: 600 }}>Vacinas e crescimento</span>
                  <span className="texto-2">Doses aplicadas, lotes e percentis</span>
                </span>
                <span className="seta">
                  <Icone nome="seta" />
                </span>
              </Link>
            </nav>
          </section>
          <p className="mudo" style={{ textAlign: 'center' }}>
            Os arquivos ficam guardados com segurança na nuvem de vocês: só a sua família vê.
          </p>
        </>
      )}

      {aberta?.modo === 'ver' && docAberto && <FolhaVer doc={docAberto} aoFechar={() => setAberta(null)} aoEditar={() => setAberta({ modo: 'editar', doc: docAberto, novo: false })} />}
      {aberta?.modo === 'editar' && <FolhaEditar inicial={aberta.doc} novo={aberta.novo} aoFechar={() => setAberta(null)} aoSalvar={(d) => setAberta({ modo: 'ver', id: d.id })} />}
      {aberta?.modo === 'exportar' && <FolhaExportar docs={doBebe} aoFechar={() => setAberta(null)} />}
    </div>
  );
}
