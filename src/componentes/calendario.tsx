import { useState } from 'react';
import { CALENDARIO_URL } from '../config';
import { useDados } from '../dados/contexto';
import { Icone } from './ui';

/** Calendário assinado do iPhone: mesma lógica do app-dieta (endereço secreto por pessoa). */
export function CartaoCalendario() {
  const { repo, membro, executar } = useDados();
  const [msg, setMsg] = useState<string | null>(null);
  const token = membro?.token_calendario;

  return (
    <section className="cartao pilha" aria-label="Calendário do iPhone">
      <div className="linha">
        <Icone nome="agenda" />
        <h2>Calendário do iPhone</h2>
      </div>
      <p className="mudo">
        Coloca a agenda do bebê (consultas, exames, vacinas e os mesversários) no Calendário do iPhone. O que você ou o outro responsável marcar no app aparece nos
        dois celulares; se mudar a data no app, muda no calendário também.
      </p>
      {repo.modo === 'local' ? (
        <div className="alerta info">Disponível quando a nuvem estiver configurada.</div>
      ) : !token ? (
        <div className="alerta">O calendário ainda não foi ativado no servidor.</div>
      ) : (
        <>
          <a className="botao primario" href={CALENDARIO_URL.replace(/^https?:/, 'webcal:') + token}>
            Adicionar ao Calendário
          </a>
          <p className="mudo">
            Toque em <b>Adicionar ao Calendário</b> e confirme em <b>Assinar</b>. Cada um faz isso uma vez, no próprio iPhone. Para receber os alertas dos
            compromissos pelo Calendário, desligue a opção <b>Remover Alertas</b> na tela da assinatura.
          </p>
          <details className="ajuda">
            <summary>Mais opções</summary>
            <div className="pilha-p">
              <button
                className="botao"
                onClick={() => {
                  const endereco = CALENDARIO_URL + token;
                  navigator.clipboard
                    .writeText(endereco)
                    .then(() => setMsg('Endereço copiado. No Google Agenda: Outras agendas → Do URL.'))
                    .catch(() => setMsg(endereco));
                }}
              >
                <Icone nome="copiar" /> Copiar endereço
              </button>
              <button
                className="botao perigo"
                onClick={() => {
                  if (!confirm('Gerar um endereço novo? O atual para de funcionar e você precisa assinar de novo no iPhone.')) return;
                  void executar((r) => r.novoTokenCalendario()).then(
                    (ok) => ok && setMsg('Novo endereço criado. Apague a assinatura antiga no iPhone (Ajustes → Calendário → Contas) e adicione de novo.'),
                  );
                }}
              >
                Gerar novo endereço
              </button>
              <p className="mudo">O iPhone atualiza calendários assinados de tempos em tempos (em Ajustes → Calendário → Contas → Buscar dá para escolher a frequência).</p>
            </div>
          </details>
          {msg && (
            <div className="alerta info" style={{ wordBreak: 'break-all' }}>
              {msg}
            </div>
          )}
        </>
      )}
    </section>
  );
}
