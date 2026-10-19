-- App Heitor · Documentos do bebê (certidão, CPF, cartão do SUS, exames, receitas...).
-- Mesmo modelo das outras listas: tudo é da família (Row Level Security pela família da conta).
-- Os arquivos (fotos e PDFs) ficam no armazenamento privado "nenem-documentos", pasta = família.
-- Idempotente: pode rodar mais de uma vez sem problema.

create table if not exists public.nenem_documentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  categoria text not null default 'outros'
    check (categoria in ('identificacao', 'saude', 'exames', 'plano', 'escola', 'viagem', 'outros')),
  -- Documento da lista principal do app (ex.: 'certidao'); vazio = documento livre
  modelo_id text check (length(modelo_id) <= 60),
  titulo text not null check (length(titulo) between 1 and 200),
  -- Número do documento (CPF, cartão do SUS, carteirinha...), para copiar rápido
  numero text check (length(numero) <= 100),
  data date,
  validade date,
  observacao text check (length(observacao) <= 2000),
  -- Lista de arquivos: [{ caminho, nome, tipo, tamanho }]
  arquivos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(arquivos) = 'array' and jsonb_array_length(arquivos) <= 40),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade
);
create unique index if not exists nenem_documentos_modelo on public.nenem_documentos (bebe_id, modelo_id) where modelo_id is not null;

alter table public.nenem_documentos enable row level security;
drop policy if exists "familia" on public.nenem_documentos;
create policy "familia" on public.nenem_documentos for all to authenticated
  using (familia_id = (select public.nenem_minha_familia()))
  with check (familia_id = (select public.nenem_minha_familia()));
drop trigger if exists nenem_documentos_atualizado on public.nenem_documentos;
create trigger nenem_documentos_atualizado before update on public.nenem_documentos
  for each row execute function public.nenem_carimbar_atualizacao();
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nenem_documentos') then
    alter publication supabase_realtime add table public.nenem_documentos;
  end if;
end $$;

-- ---------- Arquivos (armazenamento privado, pasta = família) ----------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('nenem-documentos', 'nenem-documentos', false, 20971520, array['image/jpeg', 'image/png', 'application/pdf'])
  on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "nenem documentos familia ve" on storage.objects;
  create policy "nenem documentos familia ve" on storage.objects for select to authenticated
    using (bucket_id = 'nenem-documentos' and (storage.foldername(name))[1] = (select public.nenem_minha_familia())::text);
  drop policy if exists "nenem documentos familia grava" on storage.objects;
  create policy "nenem documentos familia grava" on storage.objects for insert to authenticated
    with check (bucket_id = 'nenem-documentos' and (storage.foldername(name))[1] = (select public.nenem_minha_familia())::text);
  drop policy if exists "nenem documentos familia apaga" on storage.objects;
  create policy "nenem documentos familia apaga" on storage.objects for delete to authenticated
    using (bucket_id = 'nenem-documentos' and (storage.foldername(name))[1] = (select public.nenem_minha_familia())::text);
exception
  when insufficient_privilege or undefined_table or undefined_function or invalid_schema_name then
    raise warning 'Documentos: não foi possível configurar o armazenamento (%). O resto do app funciona.', sqlerrm;
end $$;
