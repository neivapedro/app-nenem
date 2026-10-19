-- App Heitor · Fase 2: saúde, desenvolvimento, leite materno, primeiros dias e atalhos da Siri.
-- Mesmo modelo da Fase 1: tudo é da família (Row Level Security pela família da conta).
-- Idempotente: pode rodar mais de uma vez sem problema.

-- ---------- Registros: tipos novos ----------
-- remédio (dose dada), temperatura, extração de leite e refeição (introdução alimentar)
alter table public.nenem_registros drop constraint if exists nenem_registros_tipo_check;
alter table public.nenem_registros add constraint nenem_registros_tipo_check
  check (tipo in ('mamada', 'mamadeira', 'fralda', 'sono', 'remedio', 'temperatura', 'extracao', 'refeicao'));

-- ---------- Bebê: calendário de vacinas escolhido ----------
-- 'pni' = só o SUS; 'sbp' = SUS + rede particular (Sociedade Brasileira de Pediatria)
alter table public.nenem_bebes add column if not exists calendario_vacinal text not null default 'pni';
alter table public.nenem_bebes drop constraint if exists nenem_bebes_calendario_vacinal_check;
alter table public.nenem_bebes add constraint nenem_bebes_calendario_vacinal_check check (calendario_vacinal in ('pni', 'sbp'));

-- ---------- Membros: avisos novos e token dos atalhos da Siri ----------
alter table public.nenem_membros add column if not exists lembrete_remedio boolean not null default true;
alter table public.nenem_membros add column if not exists lembrete_vacina boolean not null default true;
-- Endereço secreto dos atalhos (registrar pela Siri sem abrir o app); diferente do calendário
alter table public.nenem_membros add column if not exists token_atalho text unique
  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update public.nenem_membros
  set token_atalho = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where token_atalho is null;

-- ---------- Crescimento ----------
create table if not exists public.nenem_medidas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  data date not null,
  peso_g int check (peso_g between 300 and 40000),
  comprimento_cm numeric(4,1) check (comprimento_cm between 20 and 130),
  pc_cm numeric(4,1) check (pc_cm between 18 and 60),
  observacao text check (length(observacao) <= 2000),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade,
  check (peso_g is not null or comprimento_cm is not null or pc_cm is not null)
);
create index if not exists nenem_medidas_bebe_data on public.nenem_medidas (bebe_id, data);

-- ---------- Vacinas (doses aplicadas ou puladas; o calendário fica no app) ----------
create table if not exists public.nenem_vacinas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  -- id da dose no calendário do app (ex.: 'bcg') ou 'extra:<texto>' para dose fora do calendário
  dose_id text not null check (length(dose_id) between 1 and 120),
  nome text check (length(nome) <= 200),
  status text not null default 'aplicada' check (status in ('aplicada', 'pulada')),
  data date,
  rede text check (rede in ('sus', 'particular')),
  local text check (length(local) <= 300),
  lote text check (length(lote) <= 100),
  observacao text check (length(observacao) <= 2000),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade,
  unique (bebe_id, dose_id),
  check (status = 'pulada' or data is not null)
);

-- ---------- Remédios em uso ----------
create table if not exists public.nenem_remedios (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  nome text not null check (length(nome) between 1 and 120),
  dose text check (length(dose) <= 120),
  -- Intervalo entre doses em horas (vazio = só quando precisar)
  intervalo_h numeric(4,1) check (intervalo_h > 0 and intervalo_h <= 168),
  ativo boolean not null default true,
  observacao text check (length(observacao) <= 2000),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade
);

-- ---------- Estoque de leite materno ----------
create table if not exists public.nenem_leite (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.nenem_familias on delete cascade,
  extraido_em timestamptz not null,
  ml int not null check (ml between 1 and 1000),
  local text not null default 'geladeira' check (local in ('geladeira', 'freezer')),
  usado_em timestamptz,
  descartado_em timestamptz,
  observacao text check (length(observacao) <= 500),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- Marcos, primeiras vezes e fotos do mês ----------
create table if not exists public.nenem_marcos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  tipo text not null check (tipo in ('caderneta', 'primeira-vez', 'mes')),
  -- Marco da Caderneta ('c-...') ou mês da foto ('mes-3'); vazio nas primeiras vezes
  marco_id text check (length(marco_id) <= 60),
  titulo text check (length(titulo) <= 200),
  data date,
  observacao text check (length(observacao) <= 2000),
  -- Caminho da foto no armazenamento (bucket nenem-fotos): <familia>/<arquivo>.jpg
  foto text check (length(foto) <= 300),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade
);
create unique index if not exists nenem_marcos_unico on public.nenem_marcos (bebe_id, marco_id) where marco_id is not null;

-- ---------- Primeiros dias (checklist) ----------
create table if not exists public.nenem_tarefas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.nenem_familias on delete cascade,
  -- Item da lista padrão do app (ex.: 'pezinho'); vazio = item criado por vocês
  item_id text check (length(item_id) <= 60),
  titulo text check (length(titulo) <= 200),
  data date,
  feito_em timestamptz,
  observacao text check (length(observacao) <= 2000),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists nenem_tarefas_unico on public.nenem_tarefas (familia_id, item_id) where item_id is not null;

-- ---------- Regras (família) e carimbo de atualização ----------
do $$
declare t text;
begin
  foreach t in array array['nenem_medidas', 'nenem_vacinas', 'nenem_remedios', 'nenem_leite', 'nenem_marcos', 'nenem_tarefas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "familia" on public.%I', t);
    execute format(
      'create policy "familia" on public.%I for all to authenticated
         using (familia_id = (select public.nenem_minha_familia()))
         with check (familia_id = (select public.nenem_minha_familia()))', t);
    execute format('drop trigger if exists %I on public.%I', t || '_atualizado', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.nenem_carimbar_atualizacao()', t || '_atualizado', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Fotos (armazenamento privado, pasta = família) ----------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('nenem-fotos', 'nenem-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  drop policy if exists "nenem fotos familia ve" on storage.objects;
  create policy "nenem fotos familia ve" on storage.objects for select to authenticated
    using (bucket_id = 'nenem-fotos' and (storage.foldername(name))[1] = (select public.nenem_minha_familia())::text);
  drop policy if exists "nenem fotos familia grava" on storage.objects;
  create policy "nenem fotos familia grava" on storage.objects for insert to authenticated
    with check (bucket_id = 'nenem-fotos' and (storage.foldername(name))[1] = (select public.nenem_minha_familia())::text);
  drop policy if exists "nenem fotos familia altera" on storage.objects;
  create policy "nenem fotos familia altera" on storage.objects for update to authenticated
    using (bucket_id = 'nenem-fotos' and (storage.foldername(name))[1] = (select public.nenem_minha_familia())::text);
  drop policy if exists "nenem fotos familia apaga" on storage.objects;
  create policy "nenem fotos familia apaga" on storage.objects for delete to authenticated
    using (bucket_id = 'nenem-fotos' and (storage.foldername(name))[1] = (select public.nenem_minha_familia())::text);
exception
  when insufficient_privilege or undefined_table or undefined_function or invalid_schema_name then
    raise warning 'Fotos: não foi possível configurar o armazenamento (%). O resto do app funciona.', sqlerrm;
end $$;
