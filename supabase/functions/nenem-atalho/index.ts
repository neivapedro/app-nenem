// Edge Function (Deno): atalhos da Siri. O app Atalhos do iPhone chama
//   https://…/functions/v1/nenem-atalho?t=TOKEN&acao=fralda-xixi
// e a resposta (texto curto) é lida pela Siri. O token é secreto e individual
// (nenem_membros.token_atalho): o registro sai em nome de quem criou o atalho.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { fecharTrecho, ladoAberto, minutos, type Segmento } from '../_shared/atalhos.ts';
import { dataNoFuso, horaNoFuso, localParaUtc } from '../_shared/tempo.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const texto = (t: string, status = 200) => new Response(t, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  const p = new URL(req.url).searchParams;
  const token = p.get('t') ?? '';
  const acao = p.get('acao') ?? '';
  if (!/^[a-f0-9]{32,}$/.test(token)) return texto('Atalho inválido. Copie o endereço de novo no app.', 404);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: membro } = await db.from('nenem_membros').select('familia_id, user_id, fuso_horario').eq('token_atalho', token).maybeSingle();
  if (!membro) return texto('Atalho inválido ou trocado. Copie o endereço de novo no app.', 404);
  const { data: bebe } = await db.from('nenem_bebes').select('id, nome').eq('familia_id', membro.familia_id).order('criado_em').limit(1).maybeSingle();
  if (!bebe) return texto('Nenhum bebê cadastrado.', 404);

  const fuso = membro.fuso_horario || 'America/Sao_Paulo';
  const agora = new Date();
  const agoraIso = agora.toISOString();
  const hora = horaNoFuso(agora, fuso);
  const base = { familia_id: membro.familia_id, bebe_id: bebe.id, criado_por: membro.user_id };

  async function emAndamento(tipo: 'mamada' | 'sono') {
    const { data } = await db.from('nenem_registros').select('*').eq('familia_id', membro!.familia_id).eq('tipo', tipo).is('fim', null).order('inicio', { ascending: false }).limit(1).maybeSingle();
    return data;
  }

  async function inserir(tipo: string, dados: Record<string, unknown>, fim: string | null) {
    const { error } = await db.from('nenem_registros').insert({ ...base, id: crypto.randomUUID(), tipo, inicio: agoraIso, fim, dados });
    if (error) throw error;
  }

  try {
    if (acao.startsWith('fralda-')) {
      const xixi = acao !== 'fralda-coco';
      const coco = acao !== 'fralda-xixi';
      await inserir('fralda', { xixi, coco, cor: null }, agoraIso);
      return texto(`Pronto: fralda com ${xixi && coco ? 'xixi e cocô' : coco ? 'cocô' : 'xixi'} às ${hora}.`);
    }
    if (acao === 'mamada-e' || acao === 'mamada-d') {
      const aberta = await emAndamento('mamada');
      if (aberta) return texto('Já tem uma mamada em andamento. Diga "trocar peito" ou "fim da mamada".');
      const lado = acao === 'mamada-e' ? 'E' : 'D';
      await inserir('mamada', { segmentos: [{ lado, inicio: agoraIso, fim: null }] }, null);
      return texto(`Mamada no peito ${lado === 'E' ? 'esquerdo' : 'direito'} começou às ${hora}.`);
    }
    if (acao === 'mamada-trocar' || acao === 'mamada-fim') {
      const aberta = await emAndamento('mamada');
      if (!aberta) return texto('Nenhuma mamada em andamento.');
      const segs = (Array.isArray(aberta.dados?.segmentos) ? aberta.dados.segmentos : []) as Segmento[];
      const atual = ladoAberto(segs);
      const fechados = fecharTrecho(segs, agoraIso);
      if (acao === 'mamada-trocar') {
        const ultimo = segs[segs.length - 1]?.lado ?? 'D';
        const novo = (atual ?? ultimo) === 'E' ? 'D' : 'E';
        const { error } = await db.from('nenem_registros').update({ dados: { segmentos: [...fechados, { lado: novo, inicio: agoraIso, fim: null }] } }).eq('id', aberta.id);
        if (error) throw error;
        return texto(`Trocou para o peito ${novo === 'E' ? 'esquerdo' : 'direito'}.`);
      }
      const fim = fechados.reduce((m, s) => (s.fim && s.fim > m ? s.fim : m), aberta.inicio as string);
      const { error } = await db.from('nenem_registros').update({ fim, dados: { segmentos: fechados } }).eq('id', aberta.id);
      if (error) throw error;
      const total = fechados.reduce((s, x) => s + (new Date(x.fim!).getTime() - new Date(x.inicio).getTime()), 0);
      return texto(`Mamada finalizada: ${minutos(total)}.`);
    }
    if (acao === 'sono-inicio') {
      if (await emAndamento('sono')) return texto('O sono já está sendo contado. Diga "bebê acordou" para encerrar.');
      await inserir('sono', {}, null);
      return texto(`Sono começou às ${hora}. Bom descanso!`);
    }
    if (acao === 'sono-fim') {
      const aberto = await emAndamento('sono');
      if (!aberto) return texto('Nenhum sono em andamento.');
      const { error } = await db.from('nenem_registros').update({ fim: agoraIso }).eq('id', aberto.id);
      if (error) throw error;
      return texto(`Acordou: dormiu ${minutos(agora.getTime() - new Date(aberto.inicio).getTime())}.`);
    }
    if (acao === 'resumo') {
      const inicioDia = localParaUtc(dataNoFuso(agora, fuso), '00:00', fuso).toISOString();
      const { data: hoje } = await db.from('nenem_registros').select('tipo, inicio').eq('familia_id', membro.familia_id).gte('inicio', inicioDia);
      const { data: ultima } = await db
        .from('nenem_registros')
        .select('inicio')
        .eq('familia_id', membro.familia_id)
        .in('tipo', ['mamada', 'mamadeira'])
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      const alim = (hoje ?? []).filter((r) => r.tipo === 'mamada' || r.tipo === 'mamadeira').length;
      const fraldas = (hoje ?? []).filter((r) => r.tipo === 'fralda').length;
      const desde = ultima ? ` A última foi há ${minutos(agora.getTime() - new Date(ultima.inicio).getTime())}.` : '';
      return texto(`Hoje: ${alim} ${alim === 1 ? 'alimentação' : 'alimentações'} e ${fraldas} ${fraldas === 1 ? 'fralda' : 'fraldas'}.${desde}`);
    }
    return texto('Ação desconhecida. Copie o endereço de novo no app.', 400);
  } catch (e) {
    return texto(`Não consegui registrar agora: ${(e as Error).message ?? 'erro'}. Tente pelo app.`, 500);
  }
});
