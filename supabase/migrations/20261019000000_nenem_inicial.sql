-- App Nenê · acompanhamento do bebê compartilhado entre os pais.
--
-- Mesmo projeto Supabase do Diário de Carga e do app-dieta: todas as tabelas
-- deste app começam com "nenem_" e não mexem nas dos outros apps.
--
-- Diferente do app-dieta (cada conta vê só o que é dela), aqui os dados são
-- da FAMÍLIA: cada conta pertence a uma família, e tudo o que um membro grava
-- (bebê, registros, agenda) aparece para os outros membros da mesma família.
-- O isolamento entre famílias é garantido pelo Row Level Security.
--
-- Idempotente: pode rodar mais de uma vez sem problema.

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------

create table if not exists public.nenem_familias (
  id uuid primary key default gen_random_uuid(),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now()
);

-- Membro da família (uma conta pertence a uma família só)
create table if not exists public.nenem_membros (
  familia_id uuid not null references public.nenem_familias on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null default '',
  fuso_horario text not null default 'America/Sao_Paulo',
  -- Aviso "já faz X horas desde a última mamada" (neste membro)
  lembrete_mamada boolean not null default false,
  lembrete_mamada_min int not null default 180 check (lembrete_mamada_min between 30 and 600),
  -- Aviso dos compromissos da agenda
  lembrete_agenda boolean not null default true,
  -- Endereço secreto do calendário assinado (um por membro)
  token_calendario text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  criado_em timestamptz not null default now(),
  primary key (familia_id, user_id)
);
create unique index if not exists nenem_membros_user_unico on public.nenem_membros (user_id);

create table if not exists public.nenem_bebes (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.nenem_familias on delete cascade,
  nome text not null default '',
  sexo text check (sexo in ('M', 'F')),
  data_prevista date,
  nascimento timestamptz,
  peso_nascer_g int check (peso_nascer_g between 300 and 7000),
  altura_nascer_cm numeric(4,1) check (altura_nascer_cm between 20 and 70),
  pc_nascer_cm numeric(4,1) check (pc_nascer_cm between 18 and 50),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, familia_id)
);

-- Mamada, mamadeira, fralda e sono. O id é criado no aparelho (reenviar
-- pela fila offline nunca duplica). "fim" vazio = em andamento (cronômetro).
create table if not exists public.nenem_registros (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  tipo text not null check (tipo in ('mamada', 'mamadeira', 'fralda', 'sono')),
  inicio timestamptz not null,
  fim timestamptz,
  dados jsonb not null default '{}'::jsonb,
  observacao text check (length(observacao) <= 2000),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade,
  check (fim is null or fim >= inicio)
);
create index if not exists nenem_registros_familia_inicio on public.nenem_registros (familia_id, inicio desc);

-- Agenda: consultas, exames, vacinas e outros compromissos.
-- data + hora "de parede" (hora vazia = dia inteiro), no fuso de cada membro.
create table if not exists public.nenem_compromissos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.nenem_familias on delete cascade,
  tipo text not null default 'consulta' check (tipo in ('consulta', 'exame', 'vacina', 'outro')),
  titulo text not null check (length(titulo) between 1 and 200),
  data date not null,
  hora time,
  duracao_min int not null default 60 check (duracao_min between 5 and 1440),
  local text check (length(local) <= 300),
  observacao text check (length(observacao) <= 2000),
  -- Minutos de antecedência do aviso (vazio = sem aviso)
  avisar_min int check (avisar_min between 0 and 20160),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists nenem_compromissos_familia_data on public.nenem_compromissos (familia_id, data);

-- Convite para o outro responsável entrar na família (código de 6 letras)
create table if not exists public.nenem_convites (
  codigo text primary key,
  familia_id uuid not null references public.nenem_familias on delete cascade,
  criado_por uuid default auth.uid() references auth.users on delete set null,
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references auth.users on delete set null,
  usado_em timestamptz
);

-- Aparelhos inscritos para receber os avisos (separado do app-dieta)
create table if not exists public.nenem_inscricoes_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

-- Controle interno da função de avisos (não avisar duas vezes a mesma coisa)
create table if not exists public.nenem_lembretes_enviados (
  chave text primary key,
  enviado_em timestamptz not null default now()
);

-- ---------- Funções auxiliares ----------

-- Família da conta logada (security definer: usada dentro das regras sem recursão)
create or replace function public.nenem_minha_familia() returns uuid
language sql stable security definer set search_path = public as $$
  select familia_id from nenem_membros where user_id = auth.uid()
$$;
revoke all on function public.nenem_minha_familia() from public, anon;
grant execute on function public.nenem_minha_familia() to authenticated;

create or replace function public.nenem_carimbar_atualizacao() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists nenem_bebes_atualizado on public.nenem_bebes;
create trigger nenem_bebes_atualizado before update on public.nenem_bebes
  for each row execute function public.nenem_carimbar_atualizacao();
drop trigger if exists nenem_registros_atualizado on public.nenem_registros;
create trigger nenem_registros_atualizado before update on public.nenem_registros
  for each row execute function public.nenem_carimbar_atualizacao();
drop trigger if exists nenem_compromissos_atualizado on public.nenem_compromissos;
create trigger nenem_compromissos_atualizado before update on public.nenem_compromissos
  for each row execute function public.nenem_carimbar_atualizacao();

-- ---------- Row Level Security ----------

alter table public.nenem_familias enable row level security;
alter table public.nenem_membros enable row level security;
alter table public.nenem_bebes enable row level security;
alter table public.nenem_registros enable row level security;
alter table public.nenem_compromissos enable row level security;
alter table public.nenem_convites enable row level security;
alter table public.nenem_inscricoes_push enable row level security;
-- Só a função de avisos (service role) acessa este controle
alter table public.nenem_lembretes_enviados enable row level security;

drop policy if exists "familia ve" on public.nenem_familias;
create policy "familia ve" on public.nenem_familias for select to authenticated
  using (id = (select public.nenem_minha_familia()));

-- Membros: todos da família se veem; cada um só altera a própria linha
drop policy if exists "familia ve" on public.nenem_membros;
create policy "familia ve" on public.nenem_membros for select to authenticated
  using (familia_id = (select public.nenem_minha_familia()));
drop policy if exists "proprio altera" on public.nenem_membros;
create policy "proprio altera" on public.nenem_membros for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and familia_id = (select public.nenem_minha_familia()));

do $$
declare t text;
begin
  foreach t in array array['nenem_bebes', 'nenem_registros', 'nenem_compromissos'] loop
    execute format('drop policy if exists "familia" on public.%I', t);
    execute format(
      'create policy "familia" on public.%I for all to authenticated
         using (familia_id = (select public.nenem_minha_familia()))
         with check (familia_id = (select public.nenem_minha_familia()))', t);
  end loop;
end $$;

drop policy if exists "familia ve" on public.nenem_convites;
create policy "familia ve" on public.nenem_convites for select to authenticated
  using (familia_id = (select public.nenem_minha_familia()));

drop policy if exists "dono" on public.nenem_inscricoes_push;
create policy "dono" on public.nenem_inscricoes_push for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Ações (RPC) ----------

-- Cria a família, o membro e o bebê de uma vez (a conta ainda não tem família)
create or replace function public.nenem_criar_familia(
  p_nome text, p_fuso text, p_bebe_nome text, p_sexo text, p_data_prevista date, p_nascimento timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if exists (select 1 from nenem_membros where user_id = auth.uid()) then
    raise exception 'Esta conta já faz parte de uma família.';
  end if;
  insert into nenem_familias (criado_por) values (auth.uid()) returning id into fid;
  insert into nenem_membros (familia_id, user_id, nome, fuso_horario)
    values (fid, auth.uid(), coalesce(trim(p_nome), ''), coalesce(nullif(p_fuso, ''), 'America/Sao_Paulo'));
  insert into nenem_bebes (familia_id, nome, sexo, data_prevista, nascimento)
    values (fid, coalesce(trim(p_bebe_nome), ''), p_sexo, p_data_prevista, p_nascimento);
  return fid;
end $$;

-- Gera um código de convite (válido por 7 dias, uso único)
create or replace function public.nenem_criar_convite() returns table (codigo text, expira_em timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  fid uuid := nenem_minha_familia();
  letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  if fid is null then raise exception 'Crie a família antes de convidar.'; end if;
  -- Um convite aberto por família: o novo substitui os anteriores ainda não usados
  delete from nenem_convites v where v.familia_id = fid and v.usado_por is null;
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(letras, 1 + floor(random() * length(letras))::int, 1);
    end loop;
    exit when not exists (select 1 from nenem_convites v where v.codigo = c);
  end loop;
  insert into nenem_convites (codigo, familia_id) values (c, fid);
  return query select v.codigo, v.expira_em from nenem_convites v where v.codigo = c;
end $$;

-- Entra na família pelo código recebido
create or replace function public.nenem_entrar_familia(p_codigo text, p_nome text, p_fuso text) returns uuid
language plpgsql security definer set search_path = public as $$
declare conv nenem_convites;
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  if exists (select 1 from nenem_membros where user_id = auth.uid()) then
    raise exception 'Esta conta já faz parte de uma família.';
  end if;
  select * into conv from nenem_convites
    where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
    for update;
  if conv.codigo is null or conv.usado_por is not null or conv.expira_em < now() then
    raise exception 'Código de convite inválido ou vencido. Peça um código novo.';
  end if;
  insert into nenem_membros (familia_id, user_id, nome, fuso_horario)
    values (conv.familia_id, auth.uid(), coalesce(trim(p_nome), ''), coalesce(nullif(p_fuso, ''), 'America/Sao_Paulo'));
  update nenem_convites set usado_por = auth.uid(), usado_em = now() where codigo = conv.codigo;
  return conv.familia_id;
end $$;

-- Inscrição de push por aparelho: se outra conta entrar no mesmo aparelho, o
-- endereço passa para ela (como no app-dieta)
create or replace function public.nenem_assumir_inscricao_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem sessão'; end if;
  insert into nenem_inscricoes_push (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

revoke all on function public.nenem_criar_familia(text, text, text, text, date, timestamptz) from public, anon;
revoke all on function public.nenem_criar_convite() from public, anon;
revoke all on function public.nenem_entrar_familia(text, text, text) from public, anon;
revoke all on function public.nenem_assumir_inscricao_push(text, text, text) from public, anon;
grant execute on function public.nenem_criar_familia(text, text, text, text, date, timestamptz) to authenticated;
grant execute on function public.nenem_criar_convite() to authenticated;
grant execute on function public.nenem_entrar_familia(text, text, text) to authenticated;
grant execute on function public.nenem_assumir_inscricao_push(text, text, text) to authenticated;

-- ---------- Tempo real ----------
-- O que um registra aparece na hora no celular do outro

do $$
declare t text;
begin
  foreach t in array array['nenem_bebes', 'nenem_registros', 'nenem_compromissos', 'nenem_membros'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Avisos no celular ----------
-- Chama a função "nenem-lembretes" a cada 5 minutos. Usa os mesmos segredos do
-- Vault já criados para o app-dieta (URL do projeto e CRON_SECRET).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'nenem-lembretes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_dieta_projeto_url') || '/functions/v1/nenem-lembretes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'app_dieta_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
