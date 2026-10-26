import { useState } from 'react';
import { useDados } from '../dados/contexto';
import { agoraIso, chaveDia, dataBr, deCampoDataHora, paraCampoDataHora } from '../lib/datas';
import type { Bebe } from '../lib/tipos';
import { Campo, Escolhas, Folha } from './ui';

const numOuNulo = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/**
 * Dados do bebê. Com `nascimento`, é a folha "O bebê nasceu!": já vem com a
 * hora de agora e pede as medidas do nascimento.
 */
export function FolhaBebe({ aoFechar, nascimento }: { aoFechar: () => void; nascimento?: boolean }) {
  const { bebe, gravar, mostrarAviso, medidas, vacinas } = useDados();
  const [nome, setNome] = useState(bebe?.nome ?? '');
  const [sexo, setSexo] = useState<Bebe['sexo']>(bebe?.sexo ?? null);
  const [prevista, setPrevista] = useState(bebe?.data_prevista ?? '');
  const [nasceu, setNasceu] = useState(nascimento || !!bebe?.nascimento);
  const [quando, setQuando] = useState(paraCampoDataHora(bebe?.nascimento ?? agoraIso()));
  const [peso, setPeso] = useState(bebe?.peso_nascer_g ? String(bebe.peso_nascer_g) : '');
  const [altura, setAltura] = useState(bebe?.altura_nascer_cm ? String(bebe.altura_nascer_cm).replace('.', ',') : '');
  const [pc, setPc] = useState(bebe?.pc_nascer_cm ? String(bebe.pc_nascer_cm).replace('.', ',') : '');
  const [msg, setMsg] = useState<string | null>(null);

  if (!bebe) return null;

  function salvar() {
    if (!bebe) return;
    const nasc = nasceu ? deCampoDataHora(quando) : null;
    if (nasceu && !nasc) return setMsg('Informe a data e a hora do nascimento.');
    if (nasc && new Date(nasc).getTime() > Date.now() + 5 * 60_000) return setMsg('O nascimento está no futuro.');
    const p = numOuNulo(peso);
    const a = numOuNulo(altura);
    const c = numOuNulo(pc);
    if (p !== null && !(p >= 300 && p <= 7000)) return setMsg('Peso em gramas, entre 300 e 7000 (ex.: 3250).');
    if (a !== null && !(a >= 20 && a <= 70)) return setMsg('Comprimento em cm, entre 20 e 70 (ex.: 49,5).');
    if (c !== null && !(c >= 18 && c <= 50)) return setMsg('Perímetro cefálico em cm, entre 18 e 50 (ex.: 34).');
    // Voltar para "ainda não nasceu" apaga a data e as medidas do nascimento: confirma antes
    if (bebe.nascimento && !nasc && !confirm('Marcar como "ainda não nasceu"? A data, a hora e as medidas do nascimento serão apagadas.')) return;
    // Nova data de nascimento depois de medidas ou vacinas já anotadas: avisa (elas ficam fora das contas)
    if (nasc && nasc !== bebe.nascimento) {
      const dia = chaveDia(nasc);
      const antes = medidas.filter((m) => m.data < dia).length + vacinas.filter((v) => v.status === 'aplicada' && v.data && v.data < dia).length;
      if (antes && !confirm(`Há ${antes === 1 ? '1 medida ou vacina anotada' : `${antes} medidas ou vacinas anotadas`} antes de ${dataBr(dia)}. Elas continuam guardadas, mas ficam fora dos gráficos e das contas. Salvar mesmo assim?`)) return;
    }
    const novo: Bebe = {
      ...bebe,
      nome: nome.trim(),
      sexo,
      data_prevista: prevista || null,
      nascimento: nasc,
      peso_nascer_g: nasceu && p !== null ? Math.round(p) : null,
      altura_nascer_cm: nasceu ? a : null,
      pc_nascer_cm: nasceu ? c : null,
    };
    gravar({ tipo: 'bebe', dado: novo });
    const chegou = !bebe.nascimento && !!nasc;
    mostrarAviso({ texto: chegou ? `Bem-vind${sexo === 'M' ? 'o' : sexo === 'F' ? 'a' : 'o(a)'}${novo.nome ? `, ${novo.nome}` : ''}! 🎉` : 'Dados do bebê salvos' });
    aoFechar();
  }

  return (
    <Folha titulo={nascimento ? 'O bebê nasceu! 🎉' : 'Dados do bebê'} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <Campo rotulo="Nome">
          <input value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Como vocês vão chamar" autoCapitalize="words" />
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
        {!nascimento && (
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
        )}
        {!nasceu && (
          <Campo rotulo="Data prevista do parto">
            <input type="date" value={prevista} onChange={(e) => setPrevista(e.target.value)} />
          </Campo>
        )}
        {nasceu && (
          <>
            <Campo rotulo="Data e hora do nascimento">
              <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} required />
            </Campo>
            <div className="grade grade-3">
              <Campo rotulo="Peso (g)">
                <input inputMode="numeric" pattern="[0-9]*" value={peso} onChange={(e) => setPeso(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="3250" />
              </Campo>
              <Campo rotulo="Compr. (cm)">
                <input inputMode="decimal" value={altura} onChange={(e) => setAltura(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))} placeholder="49,5" />
              </Campo>
              <Campo rotulo="Cabeça (cm)">
                <input inputMode="decimal" value={pc} onChange={(e) => setPc(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))} placeholder="34" />
              </Campo>
            </div>
            <p className="mudo">As medidas do nascimento são opcionais e você pode completar depois (estão na caderneta da maternidade). "Cabeça" é o perímetro cefálico.</p>
          </>
        )}
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario">{nascimento ? 'Registrar nascimento' : 'Salvar'}</button>
      </form>
    </Folha>
  );
}
