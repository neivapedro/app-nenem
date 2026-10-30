// Faixa "Para usar como app": uma linha + botão "Como?" que abre o passo a passo.
import { useState } from 'react';
import '../estilos/dicas.css';
import { ehIOS, instaladoComoApp } from '../lib/notificacoes';
import { Folha, Icone } from './ui';

const CHAVE = 'app-nenem:dica-instalar';

export function DicaInstalar({ dispensavel = true, curta = 'Instale na Tela de Início para usar como app.' }: { dispensavel?: boolean; curta?: string }) {
  const [fechada, setFechada] = useState(() => {
    if (!dispensavel) return false;
    try {
      return localStorage.getItem(CHAVE) === '1';
    } catch {
      return false;
    }
  });
  const [aberta, setAberta] = useState(false);
  if (fechada || !ehIOS() || instaladoComoApp()) return null;
  return (
    <>
      <div className="dica-faixa">
        <Icone nome="compartilhar" />
        <span className="dica-texto">{curta}</span>
        <button type="button" className="dica-como" onClick={() => setAberta(true)}>
          Como?
        </button>
        {dispensavel && (
          <button
            type="button"
            className="dica-fechar"
            aria-label="Fechar dica"
            onClick={() => {
              setFechada(true);
              try {
                localStorage.setItem(CHAVE, '1');
              } catch {
                /* nada */
              }
            }}
          >
            <Icone nome="fechar" />
          </button>
        )}
      </div>
      {aberta && (
        <Folha titulo="Usar como app" aoFechar={() => setAberta(false)}>
          <ol className="dica-passos">
            <li>
              No Safari, toque em <b>Compartilhar</b>.
            </li>
            <li>
              Escolha <b>Adicionar à Tela de Início</b>.
            </li>
            <li>Abra pelo ícone do app e entre de novo com o mesmo e-mail e senha.</li>
            <li>Só assim os avisos (remédio, vacina, mamada) funcionam no iPhone.</li>
          </ol>
          <button type="button" className="botao primario largo" onClick={() => setAberta(false)}>
            Entendi
          </button>
        </Folha>
      )}
    </>
  );
}
