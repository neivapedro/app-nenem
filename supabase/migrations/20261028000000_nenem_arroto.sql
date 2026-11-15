-- App Heitor · Arroto: cronômetro do bebê em pé depois da mamada (meta de 20 min).
-- Idempotente: pode rodar mais de uma vez sem problema.
alter table public.nenem_registros drop constraint if exists nenem_registros_tipo_check;
alter table public.nenem_registros add constraint nenem_registros_tipo_check
  check (tipo in ('mamada', 'mamadeira', 'fralda', 'sono', 'remedio', 'temperatura', 'extracao', 'refeicao', 'arroto'));
