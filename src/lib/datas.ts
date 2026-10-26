// Datas no fuso do aparelho (os dois responsáveis estão no mesmo fuso).

const dois = (n: number) => String(n).padStart(2, '0');

/** AAAA-MM-DD de um instante no fuso do aparelho */
export function chaveDia(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${dois(x.getMonth() + 1)}-${dois(x.getDate())}`;
}

export function hojeLocal(agora = new Date()): string {
  return chaveDia(agora);
}

/** Meia-noite local do dia AAAA-MM-DD */
export function inicioDoDia(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function somarDiasLocal(dia: string, n: number): string {
  const d = inicioDoDia(dia);
  d.setDate(d.getDate() + n);
  return chaveDia(d);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / 86_400_000);
}

/** 14:05 */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** Duração em texto: "45 s", "12 min", "1h 05min", "3h" */
export function textoDuracao(ms: number, comSegundos = false): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  if (comSegundos && totalSeg < 60) return `${totalSeg} s`;
  const totalMin = Math.floor(totalSeg / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${dois(m)}min` : `${h}h`;
}

/** Cronômetro: 07:42 ou 1:07:42 */
export function relogio(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return h ? `${h}:${dois(m)}:${dois(seg)}` : `${dois(m)}:${dois(seg)}`;
}

/** "agora", "há 12 min", "há 1h 20min", "há 2 dias" */
export function haQuanto(iso: string, agora: Date): string {
  const ms = agora.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'agora';
  // Depois de um dia, em dias (e não "há 52h 48min")
  if (ms >= 86_400_000) {
    const dias = Math.floor(ms / 86_400_000);
    return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
  }
  return `há ${textoDuracao(ms)}`;
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Hoje", "Ontem", "Amanhã", "sexta, 13 nov" */
export function nomeDia(dia: string, hoje: string): string {
  const dif = diasEntre(hoje, dia);
  if (dif === 0) return 'Hoje';
  if (dif === -1) return 'Ontem';
  if (dif === 1) return 'Amanhã';
  const d = inicioDoDia(dia);
  const ano = d.getFullYear() !== inicioDoDia(hoje).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}${ano}`;
}

/** 13/11/2026 */
export function dataBr(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

/**
 * Idade do bebê: "Nasceu hoje", "3 dias", "2 semanas e 1 dia" (até 1 mês),
 * "1 mês e 4 dias", "5 meses", "1 ano e 2 meses".
 */
export function idadeBebe(nascimentoIso: string, agora: Date): string {
  const nasc = inicioDoDia(chaveDia(nascimentoIso));
  const hoje = inicioDoDia(chaveDia(agora));
  const dias = Math.round((hoje.getTime() - nasc.getTime()) / 86_400_000);
  if (dias < 0) return 'Ainda não nasceu';
  if (dias === 0) return 'Nasceu hoje';
  let meses = (hoje.getFullYear() - nasc.getFullYear()) * 12 + (hoje.getMonth() - nasc.getMonth());
  // Nascido dia 31: em fevereiro o mesversário é o último dia do mês
  const ultimoDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  if (hoje.getDate() < Math.min(nasc.getDate(), ultimoDoMes)) meses--;
  if (meses < 1) {
    if (dias < 14) return dias === 1 ? '1 dia' : `${dias} dias`;
    const sem = Math.floor(dias / 7);
    const resto = dias % 7;
    return `${sem} semanas${resto ? ` e ${resto === 1 ? '1 dia' : `${resto} dias`}` : ''}`;
  }
  const marco = new Date(nasc.getFullYear(), nasc.getMonth() + meses, 1);
  const ultimoDia = new Date(marco.getFullYear(), marco.getMonth() + 1, 0).getDate();
  marco.setDate(Math.min(nasc.getDate(), ultimoDia));
  const diasResto = Math.round((hoje.getTime() - marco.getTime()) / 86_400_000);
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  if (anos) {
    const a = anos === 1 ? '1 ano' : `${anos} anos`;
    return m ? `${a} e ${m === 1 ? '1 mês' : `${m} meses`}` : a;
  }
  const txtMeses = meses === 1 ? '1 mês' : `${meses} meses`;
  return diasResto ? `${txtMeses} e ${diasResto === 1 ? '1 dia' : `${diasResto} dias`}` : txtMeses;
}

/** Semanas de gestação pela data prevista (40 semanas): "38 semanas e 2 dias" */
export function semanasGestacao(dataPrevista: string, hoje: string): { semanas: number; dias: number; faltam: number } {
  const faltam = diasEntre(hoje, dataPrevista);
  const decorridos = 280 - faltam;
  return { semanas: Math.floor(decorridos / 7), dias: ((decorridos % 7) + 7) % 7, faltam };
}

/** Valor para <input type="datetime-local"> (fuso do aparelho) */
export function paraCampoDataHora(iso: string): string {
  const d = new Date(iso);
  return `${chaveDia(d)}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** De <input type="datetime-local"> para ISO; vazio ou inválido = null */
export function deCampoDataHora(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Arredonda para o minuto (registros não precisam de segundos) */
export function agoraIso(agora = new Date()): string {
  const d = new Date(agora);
  d.setSeconds(0, 0);
  return d.toISOString();
}
