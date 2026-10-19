-- App Heitor · Cofrinho: as contas do Heitor, os depósitos (quem mandou, recado),
-- o saldo informado pelo extrato, metas e o plano de aporte mensal.
-- Mesmo modelo das outras listas: tudo é da família (Row Level Security pela família da conta).
-- Valores em centavos (inteiros): nada de arredondamento de ponto flutuante.
-- Idempotente: pode rodar mais de uma vez sem problema.

create table if not exists public.nenem_cofrinho_contas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  nome text not null check (length(nome) between 1 and 80),
  tipo text not null default 'poupanca'
    check (tipo in ('caixinha', 'poupanca', 'conta', 'cdb', 'tesouro', 'fundo', 'previdencia', 'acoes', 'cofre', 'outro')),
  instituicao text check (length(instituicao) <= 80),
  agencia text check (length(agencia) <= 20),
  numero text check (length(numero) <= 40),
  titular text check (length(titular) <= 120),
  -- Chave Pix da conta: o app monta o QR Code para a família depositar
  chave_pix text check (length(chave_pix) <= 77),
  -- Cidade do titular (o QR Code do Pix pede)
  cidade text check (length(cidade) <= 60),
  rendimento text check (length(rendimento) <= 120),
  ativa boolean not null default true,
  observacao text check (length(observacao) <= 2000),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade,
  unique (id, familia_id)
);

create table if not exists public.nenem_cofrinho_movimentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  conta_id uuid not null,
  -- deposito e retirada mudam o saldo; saldo = valor do extrato naquela data
  tipo text not null check (tipo in ('deposito', 'retirada', 'saldo')),
  data date not null,
  valor_centavos bigint not null check (valor_centavos between 0 and 100000000000),
  -- Quem mandou (pai, mãe, vovó, padrinho...)
  de text check (length(de) <= 80),
  ocasiao text check (ocasiao in ('mensal', 'aniversario', 'mesversario', 'natal', 'presente', 'batizado', 'outro')),
  -- Recado para o Heitor ler quando crescer
  recado text check (length(recado) <= 1000),
  observacao text check (length(observacao) <= 2000),
  -- Comprovante (foto ou PDF), no armazenamento dos documentos
  comprovante jsonb check (comprovante is null or jsonb_typeof(comprovante) = 'object'),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (conta_id, familia_id) references public.nenem_cofrinho_contas (id, familia_id) on delete cascade
);
create index if not exists nenem_cofrinho_movimentos_conta on public.nenem_cofrinho_movimentos (conta_id, data);

create table if not exists public.nenem_cofrinho_metas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  nome text not null check (length(nome) between 1 and 80),
  emoji text check (length(emoji) <= 16),
  valor_centavos bigint not null check (valor_centavos between 1 and 100000000000),
  -- Idade do Heitor quando a meta deve estar pronta (anos)
  idade_anos smallint check (idade_anos between 1 and 40),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade
);

-- Plano: quanto e em que dia do mês vocês pretendem depositar, e o rendimento esperado
create table if not exists public.nenem_cofrinho_planos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null,
  bebe_id uuid not null,
  aporte_mensal_centavos bigint not null default 0 check (aporte_mensal_centavos between 0 and 10000000000),
  dia_aporte smallint check (dia_aporte between 1 and 28),
  -- Rendimento acima da inflação esperado (% ao ano) para a projeção
  taxa_real numeric(4,2) not null default 4 check (taxa_real between -5 and 20),
  idade_alvo smallint not null default 18 check (idade_alvo between 1 and 40),
  criado_por uuid default auth.uid() references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (bebe_id, familia_id) references public.nenem_bebes (id, familia_id) on delete cascade,
  unique (bebe_id)
);

do $$
declare t text;
begin
  foreach t in array array['nenem_cofrinho_contas', 'nenem_cofrinho_movimentos', 'nenem_cofrinho_metas', 'nenem_cofrinho_planos'] loop
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

-- Lembrete do dia do cofrinho (cada responsável liga ou desliga)
alter table public.nenem_membros add column if not exists lembrete_cofrinho boolean not null default true;
