-- Remédio com prazo: último dia do tratamento (AAAA-MM-DD). Depois dele, o app trata o remédio
-- como encerrado e os avisos de dose param. Vazio = sem prazo.
-- Reaplicada a cada publicação: idempotente.
alter table public.nenem_remedios add column if not exists termina_em date;
