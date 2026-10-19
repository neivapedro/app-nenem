import { useSearchParams } from 'react-router-dom';
import { SecaoCrescimento } from '../componentes/crescimento';
import { SecaoRemedios, SecaoTemperatura } from '../componentes/remedios';
import { SecaoVacinas } from '../componentes/vacinas';

const ABAS = [
  { id: 'vacinas', rotulo: 'Vacinas' },
  { id: 'crescimento', rotulo: 'Crescimento' },
  { id: 'remedios', rotulo: 'Remédios' },
  { id: 'temperatura', rotulo: 'Febre' },
] as const;

type Aba = (typeof ABAS)[number]['id'];

export function Saude() {
  const [params, setParams] = useSearchParams();
  const aba = (ABAS.find((a) => a.id === params.get('aba'))?.id ?? 'vacinas') as Aba;
  return (
    <div className="pilha">
      <div className="abas" role="tablist" aria-label="Saúde">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'ativo' : ''} onClick={() => setParams({ aba: a.id }, { replace: true })}>
            {a.rotulo}
          </button>
        ))}
      </div>
      {aba === 'vacinas' && <SecaoVacinas />}
      {aba === 'crescimento' && <SecaoCrescimento />}
      {aba === 'remedios' && <SecaoRemedios />}
      {aba === 'temperatura' && <SecaoTemperatura />}
    </div>
  );
}
