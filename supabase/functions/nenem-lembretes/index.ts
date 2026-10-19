// Edge Function (Deno) chamada a cada 5 minutos pelo pg_cron (migração inicial).
// Para cada membro com aparelho inscrito, decide os avisos (../_shared/lembretes.ts):
//   - "Já faz X horas desde a última mamada" (se o membro ligou o aviso)
//   - compromissos da agenda na antecedência escolhida
// Cada aviso sai uma vez só (tabela nenem_lembretes_enviados).

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { avisoCofrinho, avisoMamada, avisoSaldoCofrinho, avisosAgenda, avisosDocumentos, avisosRemedio, avisosTarefas, avisosVacina, type Alimentacao, type Aviso, type CofrinhoAviso, type DocumentoAviso, type MembroAviso, type RemedioAviso } from '../_shared/lembretes.ts';
import type { AplicacaoVacina, Calendario } from '../_shared/vacinas.ts';
import type { CompromissoIcs } from '../_shared/ics.ts';
import { dataNoFuso, somarDias } from '../_shared/tempo.ts';

const SITE = 'https://neivapedro.github.io/app-nenem/';
const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Mesmo segredo do app-dieta (guardado no Vault como 'app_dieta_cron_secret')
const cronSecret = Deno.env.get('CRON_SECRET')!;
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface Inscricao {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (!cronSecret || req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const agora = new Date();
  const res = { membros: 0, enviados: 0, inscricoes_removidas: 0 };

  const { data: inscricoes, error } = await db.from('nenem_inscricoes_push').select('id, user_id, endpoint, p256dh, auth');
  if (error) return new Response(error.message, { status: 500 });
  const porUsuario = new Map<string, Inscricao[]>();
  for (const i of inscricoes ?? []) porUsuario.set(i.user_id, [...(porUsuario.get(i.user_id) ?? []), i]);
  if (!porUsuario.size) return Response.json(res);

  const { data: membros } = await db
    .from('nenem_membros')
    .select('*')
    .in('user_id', [...porUsuario.keys()]);

  // Dados de cada família, buscados uma vez só
  interface DadosFamilia {
    ultima: Alimentacao | null;
    emAndamento: boolean;
    compromissos: CompromissoIcs[];
    bebe: { id: string; nome: string; nascimento: string; calendario: Calendario } | null;
    vacinas: AplicacaoVacina[];
    remedios: RemedioAviso[];
    tarefas: { item_id: string | null; id: string; titulo: string | null; data: string | null; feito_em: string | null }[];
    documentos: DocumentoAviso[];
    cofrinho: CofrinhoAviso;
  }
  const familias = new Map<string, DadosFamilia>();
  async function dadosDaFamilia(fid: string, fuso: string): Promise<DadosFamilia> {
    if (familias.has(fid)) return familias.get(fid)!;
    const { data: bebes } = await db.from('nenem_bebes').select('*').eq('familia_id', fid).order('criado_em');
    const nasceu = (bebes ?? []).some((b) => b.nascimento);
    const b0 = (bebes ?? []).find((b) => b.nascimento);
    const bebe = b0 ? { id: b0.id as string, nome: String(b0.nome ?? ''), nascimento: dataNoFuso(new Date(b0.nascimento), fuso), calendario: (b0.calendario_vacinal === 'sbp' ? 'sbp' : 'pni') as Calendario } : null;
    // Tabelas da Fase 2: se ainda não existirem, seguem vazias
    const inicioMes = `${dataNoFuso(agora, fuso).slice(0, 7)}-01`;
    const [{ data: vac }, { data: rem }, { data: tar }, { data: doses }, { data: docs }, { data: planos }, { data: depMes }, { data: contasCof }, { data: ultSaldo }] = await Promise.all([
      db.from('nenem_vacinas').select('dose_id, status, data').eq('familia_id', fid),
      db.from('nenem_remedios').select('id, nome, dose, intervalo_h').eq('familia_id', fid).eq('ativo', true),
      db.from('nenem_tarefas').select('id, item_id, titulo, data, feito_em').eq('familia_id', fid),
      db
        .from('nenem_registros')
        .select('id, inicio, dados')
        .eq('familia_id', fid)
        .eq('tipo', 'remedio')
        .gte('inicio', new Date(agora.getTime() - 8 * 86_400_000).toISOString())
        .order('inicio', { ascending: false }),
      // Documentos com validade (tabela nova: vazia se ainda não existir)
      db.from('nenem_documentos').select('id, titulo, validade').eq('familia_id', fid).not('validade', 'is', null),
      // Cofrinho (tabelas novas: vazias se ainda não existirem)
      db.from('nenem_cofrinho_planos').select('bebe_id, dia_aporte, aporte_mensal_centavos').eq('familia_id', fid),
      db.from('nenem_cofrinho_movimentos').select('id').eq('familia_id', fid).eq('tipo', 'deposito').gte('data', inicioMes).limit(1),
      db.from('nenem_cofrinho_contas').select('id').eq('familia_id', fid).eq('ativa', true).limit(1),
      db.from('nenem_cofrinho_movimentos').select('data').eq('familia_id', fid).eq('tipo', 'saldo').order('data', { ascending: false }).limit(1),
    ]);
    const ultimaPorRemedio = new Map<string, { id: string; inicio: string }>();
    for (const d of doses ?? []) {
      const rid = (d.dados as { remedio_id?: string } | null)?.remedio_id;
      if (rid && !ultimaPorRemedio.has(rid)) ultimaPorRemedio.set(rid, { id: d.id, inicio: d.inicio });
    }
    const remedios: RemedioAviso[] = (rem ?? []).map((x) => ({ id: x.id, nome: x.nome, dose: x.dose, intervalo_h: x.intervalo_h === null ? null : Number(x.intervalo_h), ultima: ultimaPorRemedio.get(x.id) ?? null }));
    let ultima: Alimentacao | null = null;
    let emAndamento = false;
    if (nasceu) {
      const { data: alim } = await db
        .from('nenem_registros')
        .select('id, tipo, inicio, fim, dados')
        .eq('familia_id', fid)
        .in('tipo', ['mamada', 'mamadeira'])
        .order('inicio', { ascending: false })
        .limit(5);
      ultima = (alim?.[0] as Alimentacao | undefined) ?? null;
      emAndamento = (alim ?? []).some((a) => a.tipo === 'mamada' && !a.fim);
    }
    const hoje = dataNoFuso(agora, fuso);
    const { data: comp } = await db
      .from('nenem_compromissos')
      .select('id, tipo, titulo, data, hora, duracao_min, local, observacao, avisar_min')
      .eq('familia_id', fid)
      .not('avisar_min', 'is', null)
      .gte('data', somarDias(hoje, -1))
      .lte('data', somarDias(hoje, 15));
    const compromissos = (comp ?? []).map((c) => ({ ...c, hora: c.hora ? String(c.hora).slice(0, 5) : null })) as CompromissoIcs[];
    const d: DadosFamilia = { ultima, emAndamento, compromissos, bebe, vacinas: (vac ?? []) as AplicacaoVacina[], remedios, tarefas: tar ?? [], documentos: (docs ?? []) as DocumentoAviso[],
      cofrinho: {
        familiaId: fid,
        nomeBebe: String((bebes ?? [])[0]?.nome ?? '').trim().split(' ')[0],
        diaAporte: planos?.[0]?.dia_aporte ?? null,
        aporteCentavos: Number(planos?.[0]?.aporte_mensal_centavos ?? 0),
        depositouNoMes: (depMes ?? []).length > 0,
        temConta: (contasCof ?? []).length > 0,
        ultimoSaldo: (ultSaldo?.[0]?.data as string | undefined) ?? null,
      },
    };
    familias.set(fid, d);
    return d;
  }

  for (const m of (membros ?? []) as (MembroAviso & { familia_id: string })[]) {
    res.membros++;
    const fuso = m.fuso_horario || 'America/Sao_Paulo';
    const f = await dadosDaFamilia(m.familia_id, fuso);
    const avisos: Aviso[] = [];
    const mamada = avisoMamada({ ...m, fuso_horario: fuso }, f.ultima, f.emAndamento, agora, SITE);
    if (mamada) avisos.push(mamada);
    const mf = { ...m, fuso_horario: fuso };
    avisos.push(...avisosAgenda(mf, f.compromissos, agora, SITE));
    if (f.bebe) avisos.push(...avisosVacina(mf, f.bebe, f.vacinas, agora, SITE));
    avisos.push(...avisosRemedio(mf, f.remedios, agora, SITE));
    avisos.push(...avisosTarefas(mf, m.familia_id, f.bebe?.nascimento ?? null, f.tarefas, agora, SITE));
    avisos.push(...avisosDocumentos(mf, f.documentos, agora, SITE));
    const cofrinho = avisoCofrinho(mf, f.cofrinho, agora, SITE);
    if (cofrinho) avisos.push(cofrinho);
    const saldoCof = avisoSaldoCofrinho(mf, f.cofrinho, agora, SITE);
    if (saldoCof) avisos.push(saldoCof);
    if (!avisos.length) continue;

    const lista = porUsuario.get(m.user_id) ?? [];
    for (const aviso of avisos) {
      // Reserva o aviso antes de enviar: duas execuções seguidas não mandam em dobro
      const { error: jaFoi } = await db.from('nenem_lembretes_enviados').insert({ chave: aviso.chave });
      if (jaFoi) continue;
      for (const i of [...lista]) {
        try {
          await webpush.sendNotification(
            { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
            JSON.stringify({ titulo: aviso.titulo, corpo: aviso.corpo, tag: aviso.tag, url: aviso.url }),
            { TTL: 60 * 60 },
          );
          res.enviados++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // Aparelho desinscrito ou app removido: apaga a inscrição
          if (status === 404 || status === 410) {
            await db.from('nenem_inscricoes_push').delete().eq('id', i.id);
            lista.splice(lista.indexOf(i), 1);
            res.inscricoes_removidas++;
          }
        }
      }
    }
  }

  // Limpa o controle antigo (mais de 30 dias)
  await db.from('nenem_lembretes_enviados').delete().lt('enviado_em', new Date(agora.getTime() - 30 * 86_400_000).toISOString());
  return Response.json(res);
});
