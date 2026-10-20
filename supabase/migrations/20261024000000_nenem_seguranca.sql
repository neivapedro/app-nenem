-- App Heitor · Segurança: fuso validado, limites de tamanho, inscrições de push
-- só em serviços de push (https), código de convite com sorteio forte e
-- controle da família (cancelar convite, sair, remover membro).
-- Idempotente: pode rodar mais de uma vez sem problema.

-- ---------- Fuso horário sempre válido ----------
-- Um fuso inválido derrubava a função de avisos (RangeError) para TODAS as famílias.
create or replace function public.nenem_validar_membro() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.fuso_horario is null
     or not exists (select 1 from pg_timezone_names where name = new.fuso_horario) then
    new.fuso_horario := 'America/Sao_Paulo';
  end if;
  new.nome := left(coalesce(trim(new.nome), ''), 80);
  return new;
end $$;
drop trigger if exists nenem_membros_validar on public.nenem_membros;
create trigger nenem_membros_validar before insert or update on public.nenem_membros
  for each row execute function public.nenem_validar_membro();
update public.nenem_membros set fuso_horario = fuso_horario
  where not exists (select 1 from pg_timezone_names where name = fuso_horario);

-- ---------- Limites de tamanho que faltavam ----------
alter table public.nenem_bebes drop constraint if exists nenem_bebes_nome_tamanho;
alter table public.nenem_bebes add constraint nenem_bebes_nome_tamanho check (length(nome) <= 80) not valid;
alter table public.nenem_registros drop constraint if exists nenem_registros_dados_tamanho;
alter table public.nenem_registros add constraint nenem_registros_dados_tamanho check (octet_length(dados::text) <= 20000) not valid;

-- ---------- Push: só endereços https dos serviços de push ----------
alter table public.nenem_inscricoes_push drop constraint if exists nenem_inscricoes_push_endpoint_valido;
alter table public.nenem_inscricoes_push add constraint nenem_inscricoes_push_endpoint_valido check (
  length(endpoint) <= 1000 and length(p256dh) <= 200 and length(auth) <= 100
  and endpoint ~ '^https://([a-z0-9-]+\.)*(push\.apple\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)/'
) not valid;

-- ---------- Convite: sorteio com gerador forte (gen_random_uuid) ----------
create or replace function public.nenem_criar_convite() returns table (codigo text, expira_em timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  fid uuid := nenem_minha_familia();
  letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
  b bytea;
begin
  if fid is null then raise exception 'Crie a família antes de convidar.'; end if;
  delete from nenem_convites v where v.familia_id = fid and v.usado_por is null;
  loop
    b := uuid_send(gen_random_uuid());
    c := '';
    for i in 0..5 loop
      c := c || substr(letras, 1 + get_byte(b, i) % 32, 1);
    end loop;
    exit when not exists (select 1 from nenem_convites v where v.codigo = c);
  end loop;
  insert into nenem_convites (codigo, familia_id) values (c, fid);
  return query select v.codigo, v.expira_em from nenem_convites v where v.codigo = c;
end $$;

-- ---------- Controle da família ----------
-- Cancela o convite aberto (link enviado para a pessoa errada)
create or replace function public.nenem_cancelar_convite() returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid := nenem_minha_familia();
begin
  if fid is null then raise exception 'Sem família.'; end if;
  delete from nenem_convites where familia_id = fid and usado_por is null;
end $$;

-- Remove um membro: quem entrou antes pode remover quem entrou depois
-- (um intruso nunca consegue tirar os pais).
create or replace function public.nenem_remover_membro(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := nenem_minha_familia();
  eu nenem_membros;
  alvo nenem_membros;
begin
  if fid is null then raise exception 'Sem família.'; end if;
  select * into eu from nenem_membros where user_id = auth.uid();
  select * into alvo from nenem_membros where user_id = p_user and familia_id = fid;
  if alvo.user_id is null or alvo.user_id = eu.user_id then raise exception 'Membro não encontrado.'; end if;
  if alvo.criado_em <= eu.criado_em then raise exception 'Só quem entrou antes pode remover este membro.'; end if;
  delete from nenem_membros where user_id = p_user and familia_id = fid;
  delete from nenem_inscricoes_push where user_id = p_user;
end $$;

-- Sair da família (não deixa a família sem ninguém)
create or replace function public.nenem_sair_familia() returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid := nenem_minha_familia();
begin
  if fid is null then raise exception 'Sem família.'; end if;
  if (select count(*) from nenem_membros where familia_id = fid) < 2 then
    raise exception 'Você é o único responsável desta família.';
  end if;
  delete from nenem_membros where user_id = auth.uid();
  delete from nenem_inscricoes_push where user_id = auth.uid();
end $$;

revoke all on function public.nenem_criar_convite() from public, anon;
revoke all on function public.nenem_cancelar_convite() from public, anon;
revoke all on function public.nenem_remover_membro(uuid) from public, anon;
revoke all on function public.nenem_sair_familia() from public, anon;
revoke all on function public.nenem_validar_membro() from public, anon, authenticated;
grant execute on function public.nenem_criar_convite() to authenticated;
grant execute on function public.nenem_cancelar_convite() to authenticated;
grant execute on function public.nenem_remover_membro(uuid) to authenticated;
grant execute on function public.nenem_sair_familia() to authenticated;

-- ---------- Inscrição de push: só quem tem as mesmas chaves assume ----------
-- Antes, qualquer conta que soubesse o endereço de outro aparelho o "tomava".
-- O mesmo aparelho (outra conta entrando nele) tem as mesmas chaves: continua passando.
create or replace function public.nenem_assumir_inscricao_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  insert into nenem_inscricoes_push (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id
    where nenem_inscricoes_push.p256dh = excluded.p256dh and nenem_inscricoes_push.auth = excluded.auth;
end $$;
revoke all on function public.nenem_assumir_inscricao_push(text, text, text) from public, anon;
grant execute on function public.nenem_assumir_inscricao_push(text, text, text) to authenticated;
