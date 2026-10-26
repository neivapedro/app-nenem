-- Foto do bebê (topo do app e Ajustes): caminho no armazenamento privado "nenem-fotos",
-- no formato <familia>/<arquivo>.jpg. Vazio = ilustração padrão.
-- Reaplicada a cada publicação: idempotente.
alter table public.nenem_bebes add column if not exists foto text;
alter table public.nenem_bebes drop constraint if exists nenem_bebes_foto_check;
alter table public.nenem_bebes add constraint nenem_bebes_foto_check
  check (foto is null or (length(foto) <= 300 and foto like familia_id::text || '/%'));
