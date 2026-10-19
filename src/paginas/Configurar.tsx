import { useState, type FormEvent } from 'react';
import { FaixaConvite, useConvite } from '../componentes/convite';
import { Campo, Escolhas, Marca } from '../componentes/ui';
import { useDados } from '../dados/contexto';
import { agoraIso, deCampoDataHora, paraCampoDataHora } from '../lib/datas';
import { conviteGuardado, limparConvite } from '../lib/convite';
import { traduzirErro } from '../lib/erros';
import type { Bebe } from '../lib/tipos';

type Caminho = 'novo' | 'convite';

/** Primeiro acesso: cria a família do bebê ou entra na do outro responsável pelo código. */
export function Configurar() {
  const { repo, recarregar, usuario, sair } = useDados();
  const { convite, invalido } = useConvite();
  const [caminho, setCaminho] = useState<Caminho>(() => (conviteGuardado() ? 'convite' : 'novo'));
  const [nome, setNome] = useState('');
  const [bebeNome, setBebeNome] = useState('');
  const [sexo, setSexo] = useState<Bebe['sexo']>(null);
  const [nasceu, setNasceu] = useState(false);
  const [prevista, setPrevista] = useState('');
  const [quando, setQuando] = useState(() => paraCampoDataHora(agoraIso()));
  const [codigo, setCodigo] = useState(() => conviteGuardado() ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!nome.trim()) return setMsg('Informe o seu nome (aparece nos registros para o outro responsável).');
    if (caminho === 'convite' && codigo.replace(/[^A-Za-z0-9]/g, '').length < 6) return setMsg('Digite o código de 6 letras que você recebeu.');
    const nasc = nasceu ? deCampoDataHora(quando) : null;
    if (caminho === 'novo' && nasceu && !nasc) return setMsg('Informe a data e a hora do nascimento.');
    setEnviando(true);
    try {
      if (caminho === 'novo')
        await repo.criarFamilia({ nome: nome.trim(), bebe_nome: bebeNome.trim(), sexo, data_prevista: !nasceu && prevista ? prevista : null, nascimento: nasc });
      else await repo.entrarFamilia(codigo.trim(), nome.trim());
      limparConvite();
      await recarregar();
    } catch (e) {
      setMsg(traduzirErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="centro">
      <form className="entrada pilha" onSubmit={enviar}>
        <div className="pilha" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <Marca classe="marca-heroi" />
          <h1>Vamos começar</h1>
          <p className="mudo">{usuario?.email}</p>
        </div>
        {convite && caminho === 'convite' && <FaixaConvite convite={convite} texto="Digite seu nome e toque em Entrar na família." />}
        {invalido && caminho === 'convite' && <div className="alerta">Este convite venceu ou já foi usado. Peça um novo para quem convidou.</div>}
        {convite && caminho === 'novo' && (
          <div className="alerta">Você abriu um convite. "Começar do zero" cria outra família, separada. Para ver o mesmo bebê, use "Tenho um código".</div>
        )}
        <div className="abas">
          <button type="button" className={caminho === 'novo' ? 'ativo' : ''} onClick={() => setCaminho('novo')}>
            Começar do zero
          </button>
          <button type="button" className={caminho === 'convite' ? 'ativo' : ''} onClick={() => setCaminho('convite')}>
            Tenho um código
          </button>
        </div>
        <Campo rotulo="Seu nome">
          <input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} autoCapitalize="words" autoComplete="given-name" placeholder="Ex.: Pedro" />
        </Campo>

        {caminho === 'convite' ? (
          <>
            <Campo rotulo="Código de convite" dica="O outro responsável gera o código em Mais → Ajustes → Família.">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                placeholder="ABC123"
                style={{ letterSpacing: '0.2em', fontWeight: 700, textAlign: 'center' }}
              />
            </Campo>
          </>
        ) : (
          <>
            <Campo rotulo="Nome do bebê (pode deixar em branco)">
              <input value={bebeNome} maxLength={80} onChange={(e) => setBebeNome(e.target.value)} autoCapitalize="words" />
            </Campo>
            <Campo rotulo="Sexo" grupo>
              <Escolhas
                opcoes={[
                  { valor: 'M' as Bebe['sexo'], rotulo: 'Menino' },
                  { valor: 'F' as Bebe['sexo'], rotulo: 'Menina' },
                  { valor: null as Bebe['sexo'], rotulo: 'Não informar' },
                ]}
                valor={sexo}
                aoMudar={setSexo}
              />
            </Campo>
            <Campo rotulo="Já nasceu?" grupo>
              <Escolhas
                opcoes={[
                  { valor: false, rotulo: 'Ainda não' },
                  { valor: true, rotulo: 'Já nasceu' },
                ]}
                valor={nasceu}
                aoMudar={setNasceu}
              />
            </Campo>
            {nasceu ? (
              <Campo rotulo="Data e hora do nascimento">
                <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
              </Campo>
            ) : (
              <Campo rotulo="Data prevista do parto" dica="Para a contagem regressiva. Dá para mudar depois.">
                <input type="date" value={prevista} onChange={(e) => setPrevista(e.target.value)} />
              </Campo>
            )}
          </>
        )}
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario" disabled={enviando}>
          {enviando ? 'Aguarde…' : caminho === 'novo' ? 'Criar' : 'Entrar na família'}
        </button>
        <button type="button" className="botao texto pequeno" onClick={() => void sair()}>
          Usar outra conta
        </button>
      </form>
    </div>
  );
}
