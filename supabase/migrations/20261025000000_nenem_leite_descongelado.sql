-- Leite descongelado: vale 12 horas a partir do descongelamento (Ministério da Saúde / Rede BLH).
-- Reaplicada a cada publicação: idempotente.
alter table public.nenem_leite add column if not exists descongelado_em timestamptz;
