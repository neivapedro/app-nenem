-- App Heitor · Carteira de documentos: cartões fixos no topo, documentos da família
-- e aviso de vencimento. Idempotente: pode rodar mais de uma vez sem problema.

-- Fixado na carteira (vazio = o app decide pelo tipo: cartão do SUS, carteirinha, certidão...)
alter table public.nenem_documentos add column if not exists fixado boolean;

-- Nova categoria: documentos da família (RG dos pais, comprovante de residência...)
alter table public.nenem_documentos drop constraint if exists nenem_documentos_categoria_check;
alter table public.nenem_documentos add constraint nenem_documentos_categoria_check
  check (categoria in ('identificacao', 'saude', 'exames', 'plano', 'escola', 'viagem', 'familia', 'outros'));

-- Aviso de documento vencendo (cada responsável liga ou desliga)
alter table public.nenem_membros add column if not exists lembrete_documento boolean not null default true;
