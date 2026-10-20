// Datas e fusos, sem dependências: usado pelo app (testes) e pelas funções do servidor (Deno).

export interface PartesData {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Ano, mês, dia, hora e minuto de um instante no fuso indicado. */
export function partesNoFuso(instante: Date, fuso: string): PartesData {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, minuto: +p.minute };
}

const dois = (n: number) => String(n).padStart(2, '0');

/** O fuso do membro, se for válido; senão o de São Paulo (um fuso inválido derrubaria tudo) */
export function fusoValido(f?: string | null): string {
  try {
    if (f) {
      new Intl.DateTimeFormat('en-US', { timeZone: f });
      return f;
    }
  } catch {
    // inválido: cai no padrão
  }
  return 'America/Sao_Paulo';
}

/** Data (AAAA-MM-DD) de um instante no fuso indicado. */
export function dataNoFuso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

/** Hora (HH:MM) de um instante no fuso indicado. */
export function horaNoFuso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
}

/** Converte data + hora "de parede" de um fuso no instante correspondente. */
export function localParaUtc(data: string, hora: string, fuso: string): Date {
  const [a, m, d] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const alvo = Date.UTC(a, m - 1, d, hh, mm);
  // Duas passadas: acerta também perto de mudança de horário de verão
  let palpite = alvo;
  for (let i = 0; i < 2; i++) {
    const p = partesNoFuso(new Date(palpite), fuso);
    const comoLocal = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
    palpite += alvo - comoLocal;
  }
  return new Date(palpite);
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function diferencaDias(de: string, ate: string): number {
  const ms = (s: string) => {
    const [x, y, z] = s.split('-').map(Number);
    return Date.UTC(x, y - 1, z);
  };
  return Math.round((ms(ate) - ms(de)) / 86_400_000);
}

/** Mesma data N meses depois; dia 31 em mês curto vira o último dia do mês. */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${dois(mes)}-${dois(Math.min(d, ultimo))}`;
}
