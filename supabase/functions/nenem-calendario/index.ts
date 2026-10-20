// Edge Function (Deno): agenda da família em formato iCalendar (.ics), assinada
// pelo iPhone via webcal://…/functions/v1/nenem-calendario?t=TOKEN.
// O token é secreto e individual (nenem_membros.token_calendario): cada membro
// assina o próprio endereço, e os dois veem a mesma agenda da família.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { eventosCofrinho, eventosDocumentos, eventosTarefas, eventosVacinas, montarIcs, type CompromissoIcs, type DocumentoIcs, type EventoDia } from '../_shared/ics.ts';
import { dataNoFuso, fusoValido, somarDias } from '../_shared/tempo.ts';

/** Falha passageira do banco: melhor o iPhone tentar de novo do que receber uma agenda vazia (e apagar os eventos) */
const tenteDepois = () => new Response('Tente mais tarde', { status: 503, headers: { 'Retry-After': '600' } });

const SITE = 'https://neivapedro.github.io/app-nenem/';
const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[a-f0-9]{32,}$/.test(token)) return new Response('Calendário não encontrado', { status: 404 });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: membro, error: erroMembro } = await db.from('nenem_membros').select('familia_id, fuso_horario').eq('token_calendario', token).maybeSingle();
  if (erroMembro) return tenteDepois();
  if (!membro) return new Response('Calendário não encontrado', { status: 404 });

  const fuso = fusoValido(membro.fuso_horario);
  const agora = new Date();
  // Últimos 12 meses e tudo o que vem pela frente
  const desde = somarDias(dataNoFuso(agora, fuso), -365);
  const primeiras = await Promise.all([
    db
      .from('nenem_compromissos')
      .select('id, tipo, titulo, data, hora, duracao_min, local, observacao, avisar_min')
      .eq('familia_id', membro.familia_id)
      .gte('data', desde)
      .order('data'),
    db.from('nenem_bebes').select('id, nome, nascimento').eq('familia_id', membro.familia_id),
  ]);
  if (primeiras.some((r) => r.error)) return tenteDepois();
  const [{ data: comp }, { data: bebes }] = primeiras;
  const compromissos = (comp ?? []).map((c) => ({ ...c, hora: c.hora ? String(c.hora).slice(0, 5) : null })) as CompromissoIcs[];

  // Vacinas e prazos dos primeiros dias (tabelas da Fase 2; vazias se ainda não existirem)
  const hoje = dataNoFuso(agora, fuso);
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const segundas = await Promise.all([
    db.from('nenem_bebes').select('*').eq('familia_id', membro.familia_id).order('criado_em'),
    db.from('nenem_vacinas').select('bebe_id, dose_id, status, data').eq('familia_id', membro.familia_id),
    db.from('nenem_tarefas').select('id, item_id, titulo, data, feito_em').eq('familia_id', membro.familia_id),
    // Validade dos documentos (tabela nova: vazia se ainda não existir)
    db.from('nenem_documentos').select('id, titulo, validade').eq('familia_id', membro.familia_id).not('validade', 'is', null),
    db.from('nenem_cofrinho_planos').select('dia_aporte, aporte_mensal_centavos').eq('familia_id', membro.familia_id),
    db.from('nenem_cofrinho_movimentos').select('id').eq('familia_id', membro.familia_id).eq('tipo', 'deposito').gte('data', inicioMes).limit(1),
  ]);
  if (segundas.some((r) => r.error)) return tenteDepois();
  const [{ data: bebesCompletos }, { data: vac }, { data: tar }, { data: docs }, { data: planos }, { data: depMes }] = segundas;
  const eventos: EventoDia[] = [];
  let nascimentoFamilia: string | null = null;
  for (const b of bebesCompletos ?? []) {
    if (!b.nascimento) continue;
    const nasc = dataNoFuso(new Date(b.nascimento), fuso);
    nascimentoFamilia ??= nasc;
    eventos.push(...eventosVacinas(b.id, nasc, b.calendario_vacinal === 'sbp' ? 'sbp' : 'pni', (vac ?? []).filter((v) => v.bebe_id === b.id), hoje));
  }
  eventos.push(...eventosTarefas(membro.familia_id, nascimentoFamilia, tar ?? []));
  eventos.push(...eventosDocumentos((docs ?? []) as DocumentoIcs[]));
  eventos.push(
    ...eventosCofrinho(
      membro.familia_id,
      String(bebesCompletos?.[0]?.nome ?? '').trim().split(' ')[0],
      planos?.[0]?.dia_aporte ?? null,
      Number(planos?.[0]?.aporte_mensal_centavos ?? 0),
      (depMes ?? []).length > 0,
      hoje,
    ),
  );

  const ics = montarIcs({
    compromissos,
    bebes: bebes ?? [],
    eventos,
    fuso,
    agora,
    site: SITE,
    nomeCalendario: 'Heitor',
  });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="nenem.ics"',
      'Cache-Control': 'no-cache',
    },
  });
});
